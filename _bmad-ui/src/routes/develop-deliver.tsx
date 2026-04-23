import { useQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import type { WorkflowPhase } from "../app";
import { detectWorkflowStatus, StatusBadge } from "../app";
import {
	EmptyState,
	PageSkeleton,
	QueryErrorState,
} from "../lib/loading-states";
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode";
import { ActiveSprintSummary, EpicsProgressList } from "../lib/sprint-summary";
import type {
	AnalyticsResponse,
	OverviewResponse,
	RuntimeSession,
} from "../types";
import { rootRoute } from "./__root";

const IMPLEMENTATION_PHASE_ID = "implementation";
const HTTP_CONFLICT = 409;

const STORY_LIFECYCLE_STEPS = [
	{
		name: "Create Story",
		skill: "bmad-create-story",
		description:
			"Generate a detailed story spec with all context needed for implementation.",
	},
	{
		name: "Acceptance Tests (ATDD)",
		skill: "bmad-testarch-atdd",
		description:
			"Generate red-phase acceptance test scaffolds from story acceptance criteria.",
	},
	{
		name: "Dev Story",
		skill: "bmad-dev-story",
		description:
			"Implement the story following the spec — code, tests, and documentation.",
	},
	{
		name: "Code Review",
		skill: "bmad-code-review",
		description:
			"Adversarial code review with structured triage into actionable categories.",
	},
	{
		name: "Test Automation",
		skill: "bmad-testarch-automate",
		description:
			"Expand test coverage — fill gaps identified by test design and traceability.",
	},
	{
		name: "Test Review",
		skill: "bmad-testarch-test-review",
		description:
			"Audit test quality against best practices — target score >80 per story.",
	},
];

function ImplementationStepsTable(props: {
	phase: WorkflowPhase;
	runtimeSessions: RuntimeSession[];
	activeSkill: string | null;
	onRunSkill: (skill: string) => void;
}) {
	const { phase, runtimeSessions, activeSkill, onRunSkill } = props;

	if (phase.steps.length === 0) {
		return (
			<p className="text-sm py-2" style={{ color: "var(--muted)" }}>
				No steps in this phase.
			</p>
		);
	}

	const nonSkippedSteps = phase.steps.filter((s) => !s.isSkipped);
	const doneCount = nonSkippedSteps.filter((s) => s.isCompleted).length;
	const totalCount = nonSkippedSteps.length;

	return (
		<div>
			<div className="flex items-center gap-3 mb-4">
				<span className="text-xs" style={{ color: "var(--muted)" }}>
					{totalCount > 0
						? `${doneCount}/${totalCount} steps done`
						: "All skipped"}
				</span>
			</div>
			<div className="table-wrap">
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>Name</th>
							<th>Skill</th>
							<th>Optional</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{phase.steps.map((step, index) => {
							const isRunning = step.skill === activeSkill;
							const matchingSession = runtimeSessions.find(
								(s) => s.skill === step.skill && s.status !== "planned",
							);
							return (
								<tr key={step.id}>
									<td>
										<span
											className={`improvement-step-number${step.isCompleted ? " improvement-step-number-done" : ""}`}
										>
											{index + 1}
										</span>
									</td>
									<td>
										<strong>{step.name}</strong>
									</td>
									<td>
										<code className="improvement-step-skill">{step.skill}</code>
									</td>
									<td>{step.isOptional ? "Yes" : "No"}</td>
									<td style={{ whiteSpace: "nowrap" }}>
										{isRunning ? (
											<span className="step-badge step-running">
												<span aria-hidden="true" className="agent-icon">
													⬡
												</span>
												{" running"}
											</span>
										) : step.isSkipped ? (
											<StatusBadge status="skipped" />
										) : (
											<StatusBadge
												status={step.isCompleted ? "completed" : "not-started"}
											/>
										)}
									</td>
									<td style={{ whiteSpace: "nowrap" }}>
										<div className="improvement-actions">
											{!isRunning && !step.isSkipped && !step.isCompleted && (
												<button
													className="icon-button icon-button-play"
													disabled={!IS_LOCAL_MODE}
													onClick={() => onRunSkill(step.skill)}
													title={
														IS_LOCAL_MODE
															? `Run ${step.skill}`
															: PROD_DISABLED_TITLE
													}
													type="button"
												>
													<span aria-hidden="true" className="icon-glyph">
														▶
													</span>
												</button>
											)}
											{matchingSession ? (
												<Link
													className={`session-link-icon${matchingSession.status === "running" ? " session-link-running" : ""}${matchingSession.status === "failed" || matchingSession.status === "cancelled" ? " session-link-failed" : ""}`}
													params={{ sessionId: matchingSession.id }}
													title={`View session: ${matchingSession.id}`}
													to="/session/$sessionId"
												>
													◉
												</Link>
											) : null}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function DevelopDeliverPage() {
	const {
		data: overview,
		isLoading: overviewLoading,
		error: overviewError,
		refetch: refetchOverview,
	} = useQuery<OverviewResponse>({
		queryKey: ["overview"],
		queryFn: async () => {
			const response = await fetch(apiUrl("/api/overview"));
			if (!response.ok) {
				throw new Error(`overview request failed: ${response.status}`);
			}
			return (await response.json()) as OverviewResponse;
		},
	});

	const {
		data: analytics,
		isLoading: analyticsLoading,
		error: analyticsError,
		refetch: refetchAnalytics,
	} = useQuery<AnalyticsResponse>({
		queryKey: ["analytics"],
		queryFn: async () => {
			const response = await fetch(apiUrl("/api/analytics"));
			if (!response.ok) {
				throw new Error(`analytics request failed: ${response.status}`);
			}
			return (await response.json()) as AnalyticsResponse;
		},
	});

	if (overviewLoading || analyticsLoading) {
		return <PageSkeleton />;
	}

	if (overviewError || analyticsError) {
		return (
			<QueryErrorState
				message={String(overviewError || analyticsError)}
				onRetry={() => {
					void refetchOverview();
					void refetchAnalytics();
				}}
			/>
		);
	}

	const epics = overview?.sprintOverview.epics ?? [];
	const stories = overview?.sprintOverview.stories ?? [];
	const sessions = analytics?.sessions ?? [];
	const runtimeSessions: RuntimeSession[] =
		overview?.runtimeState?.sessions ?? [];

	const { phases } = detectWorkflowStatus(
		overview?.planningArtifactFiles ?? [],
		overview?.implementationArtifactFiles ?? [],
		runtimeSessions,
	);
	const implementationPhase = phases.find(
		(p) => p.id === IMPLEMENTATION_PHASE_ID,
	);

	const handleRunSkill = async (skill: string) => {
		if (!IS_LOCAL_MODE) return;
		try {
			const response = await fetch("/api/workflow/run-skill", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ skill }),
			});
			if (response.status === HTTP_CONFLICT) {
				throw new Error("Another workflow is already running.");
			}
			if (!response.ok) {
				throw new Error(`workflow request failed: ${response.status}`);
			}
		} catch (_err) {
			// ignore — server logs the error
		}
	};

	const inProgressStoriesCount = stories.filter(
		(s) => s.status === "in-progress",
	).length;
	const runningSessionsCount = sessions.filter(
		(s) => s.status === "running",
	).length;

	if (epics.length === 0 && stories.length === 0) {
		return (
			<EmptyState
				icon="🚀"
				title="No active sprint"
				description="Run bmad sprint-planning to set up your sprint and start tracking epics and stories."
			/>
		);
	}

	return (
		<main className="screen">
			<section className="panel reveal">
				<p className="eyebrow">Develop &amp; Deliver</p>
				<h1
					className="text-2xl font-bold mb-2"
					style={{ color: "var(--text)" }}
				>
					Sprint Status
				</h1>
				<ActiveSprintSummary
					epics={epics}
					inProgressStoriesCount={inProgressStoriesCount}
					runningSessionsCount={runningSessionsCount}
				/>
			</section>

			{implementationPhase && (
				<section className="panel reveal delay-1">
					<details open>
						<summary>
							<p className="eyebrow" style={{ display: "inline" }}>
								{`Phase ${String(implementationPhase.number)}: ${implementationPhase.name}`}
							</p>
						</summary>
						<ImplementationStepsTable
							activeSkill={overview?.activeWorkflowSkill ?? null}
							onRunSkill={(skill) => void handleRunSkill(skill)}
							phase={implementationPhase}
							runtimeSessions={runtimeSessions}
						/>
					</details>
				</section>
			)}

			<section className="panel reveal delay-2">
				<p className="eyebrow">Per-Story Lifecycle</p>
				<div className="table-wrap">
					<table>
						<thead>
							<tr>
								<th>#</th>
								<th>Name</th>
								<th>Skill</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							{STORY_LIFECYCLE_STEPS.map((step, index) => (
								<tr key={step.skill}>
									<td>
										<span className="improvement-step-number">{index + 1}</span>
									</td>
									<td>
										<strong>{step.name}</strong>
									</td>
									<td>
										<code className="improvement-step-skill">{step.skill}</code>
									</td>
									<td>{step.description}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="panel reveal delay-3">
				<p className="eyebrow">Epics</p>
				<h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
					Progress by Epic
				</h2>
				<EpicsProgressList epics={epics} />
			</section>
		</main>
	);
}

export const developDeliverRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/develop-deliver",
	component: DevelopDeliverPage,
});
