import { useQuery } from "@tanstack/react-query";
import { createRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "../app";
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode";
import type {
	EpicDetailResponse,
	OverviewResponse,
	RuntimeSession,
	StoryStatus,
	StoryWorkflowStepSkill,
	WorkflowStepState,
} from "../types";
import { rootRoute } from "./__root";

const HTTP_CONFLICT = 409;
const EPIC_NUMBER_REGEX = /^epic-(\d+)$/;
const PERCENT_MULTIPLIER = 100;
const ORCHESTRATING_STORAGE_PREFIX = "bmad-orchestrating:";
const ORCHESTRATING_INITIATED_SUFFIX = ":initiated";
const EPIC_REFETCH_INTERVAL_MS = 5_000;

const PLANNED_ONLY_STEPS: Record<StoryWorkflowStepSkill, WorkflowStepState> = {
	"bmad-create-story": "not-started",
	"bmad-dev-story": "not-started",
	"bmad-code-review": "not-started",
};

type SkillName = "bmad-create-story" | "bmad-dev-story" | "bmad-code-review";
type WorkflowSkill = SkillName | "bmad-retrospective";

function shouldClearPendingSkill(
	pendingSkill: string | null,
	stories: EpicDetailResponse["stories"],
): boolean {
	if (!pendingSkill) {
		return false;
	}

	const separatorIndex = pendingSkill.indexOf(":");
	if (separatorIndex === -1) {
		return true;
	}

	const skill = pendingSkill.slice(0, separatorIndex) as SkillName;
	const storyId = pendingSkill.slice(separatorIndex + 1);
	const story = stories.find((candidate) => candidate.id === storyId);

	if (!story) {
		return false;
	}

	return story.steps[skill] !== "not-started";
}

function getBlockingStories(
	storyId: string,
	storyDependencies: Record<string, string[]>,
	storyStatusMap: Map<string, string>,
): string[] {
	const deps = storyDependencies[storyId];
	if (!deps || deps.length === 0) {
		return [];
	}
	return deps.filter((depId) => {
		const status = storyStatusMap.get(depId);
		return status !== "done";
	});
}

const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/;

function parseStoryTicket(storyId: string): { epic: number; story: number } {
	const match = storyId.match(STORY_TICKET_REGEX);
	if (!match) {
		return { epic: Number.POSITIVE_INFINITY, story: Number.POSITIVE_INFINITY };
	}
	return {
		epic: Number(match[1]),
		story: Number(match[2]),
	};
}

function storyDisplayLabel(storyId: string): string {
	const match = storyId.match(STORY_TICKET_REGEX);
	if (!match) return storyId;
	const ticketPrefix = `${match[1]}.${match[2]}`;
	const slug = storyId.slice(match[0].length);
	const title = slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
	return `${ticketPrefix} ${title}`;
}

function findLatestSession(
	runtimeSessions: RuntimeSession[],
	storyId: string,
	skill: string,
): RuntimeSession | null {
	const matching = runtimeSessions
		.filter(
			(s) =>
				s.storyId === storyId && s.skill === skill && s.status !== "planned",
		)
		.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
	return matching[0] ?? null;
}

function SessionLink(props: { session: RuntimeSession | null }) {
	const { session } = props;
	if (!session) {
		return null;
	}

	const hasLog = session.logPath && session.logPath.length > 0;
	const isFailed =
		session.status === "failed" || session.status === "cancelled";
	const isRunning = session.status === "running";

	if (!hasLog) {
		return (
			<span
				className="session-link-icon session-link-disabled"
				title="No log available"
			>
				⊘
			</span>
		);
	}

	return (
		<Link
			className={`session-link-icon ${isRunning ? "session-link-running" : ""} ${isFailed ? "session-link-failed" : ""}`}
			params={{ sessionId: session.id }}
			title={`View session: ${session.id}`}
			to="/session/$sessionId"
		>
			◉
		</Link>
	);
}

function EpicDetailPage() {
	const { epicId } = useParams({ from: "/epic/$epicId" });
	const [pendingSkill, setPendingSkill] = useState<string | null>(null);
	const [overviewData, setOverviewData] = useState<OverviewResponse | null>(
		null,
	);
	const [isPlanning, setIsPlanning] = useState(false);
	const orchestratingKey = `${ORCHESTRATING_STORAGE_PREFIX}${epicId}`;
	const orchestratingInitiatedKey = `${orchestratingKey}${ORCHESTRATING_INITIATED_SUFFIX}`;
	const [isOrchestrating, setIsOrchestrating] = useState(() => {
		try {
			return localStorage.getItem(orchestratingKey) === "true";
		} catch {
			return false;
		}
	});
	const [bulkError, setBulkError] = useState<string | null>(null);
	const initiatedRef = useRef(
		(() => {
			try {
				const stored = localStorage.getItem(orchestratingInitiatedKey);
				return stored
					? new Set<string>(JSON.parse(stored) as string[])
					: new Set<string>();
			} catch {
				return new Set<string>();
			}
		})(),
	);
	const [orchestrationPending, setOrchestrationPending] = useState(
		new Set<string>(),
	);

	const { data: epicQueryData, error: epicError } =
		useQuery<EpicDetailResponse>({
			queryKey: ["epic", epicId],
			queryFn: async () => {
				const res = await fetch(
					apiUrl(`/api/epic/${encodeURIComponent(epicId)}`),
				);
				if (!res.ok)
					throw new Error(`epic detail request failed: ${res.status}`);
				return res.json() as Promise<EpicDetailResponse>;
			},
			refetchInterval: IS_LOCAL_MODE ? EPIC_REFETCH_INTERVAL_MS : false,
		});

	const { data: overviewQueryData } = useQuery<OverviewResponse>({
		queryKey: ["overview"],
		queryFn: async () => {
			const res = await fetch(apiUrl("/api/overview"));
			if (!res.ok) throw new Error(`overview request failed: ${res.status}`);
			return res.json() as Promise<OverviewResponse>;
		},
		refetchInterval: IS_LOCAL_MODE ? EPIC_REFETCH_INTERVAL_MS : false,
	});

	// Merge storyDependencies from overview into epic data
	const data = useMemo<EpicDetailResponse | null>(() => {
		if (!epicQueryData) return null;
		return {
			...epicQueryData,
			storyDependencies:
				overviewQueryData?.storyDependencies ?? epicQueryData.storyDependencies,
		};
	}, [epicQueryData, overviewQueryData]);

	// Keep overviewData in sync (used by EventSource updates and orchestration logic)
	const effectiveOverviewData = overviewQueryData ?? overviewData;

	const [skillError, setSkillError] = useState<string | null>(null);

	const handleRunSkill = useCallback(
		async (skill: WorkflowSkill, storyId?: string) => {
			if (!IS_LOCAL_MODE) {
				return;
			}
			setPendingSkill(storyId ? `${skill}:${storyId}` : skill);
			setSkillError(null);

			try {
				const response = await fetch("/api/workflow/run-skill", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ skill, storyId }),
				});

				if (response.status === HTTP_CONFLICT) {
					throw new Error(
						"Another workflow is already running. Wait for it to finish before starting a new one.",
					);
				}

				if (!response.ok) {
					throw new Error(`workflow request failed: ${response.status}`);
				}
			} catch (runSkillError) {
				setPendingSkill(null);
				setSkillError(String(runSkillError));
			}
		},
		[],
	);

	// EventSource is still allowed to remain as useEffect (REST fetch replaced by useQuery above)
	useEffect(() => {
		if (!IS_LOCAL_MODE || typeof EventSource === "undefined") return;
		let mounted = true;
		const eventSource = new EventSource("/api/events/overview");

		eventSource.onmessage = (event) => {
			if (!mounted) return;
			try {
				const overview = JSON.parse(event.data) as OverviewResponse;
				setOverviewData(overview);

				setPendingSkill((prevPendingSkill) =>
					shouldClearPendingSkill(
						prevPendingSkill,
						overview.sprintOverview.stories,
					)
						? null
						: prevPendingSkill,
				);

				const storyUpdates = new Map(
					overview.sprintOverview.stories.map((s) => [s.id, s]),
				);
				setOrchestrationPending((prev) => {
					if (prev.size === 0) return prev;
					let changed = false;
					const next = new Set(prev);
					for (const [storyId, update] of storyUpdates) {
						for (const skill of [
							"bmad-dev-story",
							"bmad-code-review",
						] as const) {
							const key = `${skill}:${storyId}`;
							if (next.has(key) && update.steps[skill] !== "not-started") {
								next.delete(key);
								changed = true;
							}
						}
					}
					return changed ? next : prev;
				});
			} catch {
				// ignore SSE parse errors
			}
		};

		return () => {
			mounted = false;
			eventSource.close();
		};
	}, []);

	const stories = useMemo(
		() =>
			[...(data?.stories || [])].sort((a, b) => {
				const aTicket = parseStoryTicket(a.id);
				const bTicket = parseStoryTicket(b.id);

				if (aTicket.epic !== bTicket.epic) {
					return aTicket.epic - bTicket.epic;
				}

				if (aTicket.story !== bTicket.story) {
					return aTicket.story - bTicket.story;
				}

				return a.id.localeCompare(b.id);
			}),
		[data],
	);

	const storyStatusMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const story of stories) {
			map.set(story.id, story.status);
		}
		return map;
	}, [stories]);

	const filteredStories = useMemo(() => {
		const existingIds = new Set(stories.map((s) => s.id));
		const plannedOnlyEntries = (data?.plannedStories ?? [])
			.filter((pid) => !existingIds.has(pid))
			.map((pid) => ({
				id: pid,
				status: "backlog" as StoryStatus,
				steps: PLANNED_ONLY_STEPS,
			}));
		return [...stories, ...plannedOnlyEntries].sort((a, b) => {
			const aTicket = parseStoryTicket(a.id);
			const bTicket = parseStoryTicket(b.id);
			if (aTicket.epic !== bTicket.epic) return aTicket.epic - bTicket.epic;
			if (aTicket.story !== bTicket.story) return aTicket.story - bTicket.story;
			return a.id.localeCompare(b.id);
		});
	}, [data?.plannedStories, stories]);

	const epicNumber = epicId.match(EPIC_NUMBER_REGEX)?.[1] ?? null;

	const retrospectiveState = useMemo<WorkflowStepState>(() => {
		if (!effectiveOverviewData || !epicNumber) {
			return "not-started";
		}

		const epic = effectiveOverviewData.sprintOverview.epics.find(
			(candidate) => candidate.number === Number(epicNumber),
		);

		return epic?.lifecycleSteps["bmad-retrospective"] ?? "not-started";
	}, [effectiveOverviewData, epicNumber]);

	const latestRetroSession = useMemo(() => {
		const runtimeSessions = effectiveOverviewData?.runtimeState?.sessions ?? [];
		const matching = runtimeSessions
			.filter((s) => s.skill === "bmad-retrospective" && s.status !== "planned")
			.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
		return matching[0] ?? null;
	}, [effectiveOverviewData]);

	const allStoriesDone = useMemo(
		() =>
			stories.length > 0 && stories.every((story) => story.status === "done"),
		[stories],
	);

	const storiesNeedingPlan = useMemo(() => {
		const existingIds = new Set(stories.map((s) => s.id));
		const fromPlanned = (data?.plannedStories ?? []).filter(
			(pid) => !existingIds.has(pid),
		);
		const fromExisting = stories
			.filter((s) => s.steps["bmad-create-story"] === "not-started")
			.map((s) => s.id);
		return [...fromPlanned, ...fromExisting];
	}, [data?.plannedStories, stories]);

	const showDevelopAllButton = useMemo(
		() =>
			stories.some(
				(s) =>
					s.steps["bmad-create-story"] === "completed" && s.status !== "done",
			),
		[stories],
	);

	const handlePlanAllStories = useCallback(async () => {
		if (!IS_LOCAL_MODE || !data) return;
		setIsPlanning(true);
		setBulkError(null);

		const existingIds = new Set(stories.map((s) => s.id));
		const storiesToPlan = [
			...(data.plannedStories ?? []).filter((pid) => !existingIds.has(pid)),
			...stories
				.filter((s) => s.steps["bmad-create-story"] === "not-started")
				.map((s) => s.id),
		];

		if (storiesToPlan.length === 0) {
			setIsPlanning(false);
			return;
		}

		const results = await Promise.allSettled(
			storiesToPlan.map((storyId) =>
				fetch("/api/workflow/run-skill", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ skill: "bmad-create-story", storyId }),
				}),
			),
		);

		const errors: string[] = [];
		for (const result of results) {
			if (result.status === "rejected") {
				errors.push(String(result.reason));
			} else if (!result.value.ok && result.value.status !== HTTP_CONFLICT) {
				errors.push(`request failed: ${result.value.status}`);
			}
		}

		if (errors.length > 0) {
			setBulkError(`Some story creations failed: ${errors.join("; ")}`);
		}

		setIsPlanning(false);
	}, [data, stories]);

	const handleDevelopAllStories = useCallback(() => {
		if (!IS_LOCAL_MODE) return;
		initiatedRef.current.clear();
		setOrchestrationPending(new Set());
		setIsOrchestrating(true);
		try {
			localStorage.setItem(orchestratingKey, "true");
			localStorage.removeItem(orchestratingInitiatedKey);
		} catch {
			/* storage unavailable */
		}
		setBulkError(null);
	}, [orchestratingKey, orchestratingInitiatedKey]);

	const handleStopOrchestration = useCallback(() => {
		setIsOrchestrating(false);
		setOrchestrationPending(new Set());
		try {
			localStorage.removeItem(orchestratingKey);
			localStorage.removeItem(orchestratingInitiatedKey);
		} catch {
			/* storage unavailable */
		}
	}, [orchestratingKey, orchestratingInitiatedKey]);

	// Orchestration driver: fires dev-story → code-review → retrospective as stories progress
	useEffect(() => {
		if (!isOrchestrating || !data) return;

		const runtimeSessions = effectiveOverviewData?.runtimeState?.sessions ?? [];
		const deps = data.storyDependencies ?? {};
		const currentStoryStatusMap = new Map<string, string>();
		for (const s of stories) {
			currentStoryStatusMap.set(s.id, s.status);
		}

		for (const story of stories) {
			const createState = story.steps["bmad-create-story"] ?? "not-started";
			const rawDevState = story.steps["bmad-dev-story"] ?? "not-started";
			const isDevAgentRunning = runtimeSessions.some(
				(s) => s.storyId === story.id && s.skill === "bmad-dev-story",
			);
			const devState =
				rawDevState === "running" && !isDevAgentRunning
					? "not-started"
					: rawDevState;
			const rawReviewState = story.steps["bmad-code-review"] ?? "not-started";
			const isReviewAgentRunning = runtimeSessions.some(
				(s) => s.storyId === story.id && s.skill === "bmad-code-review",
			);
			const reviewState =
				rawReviewState === "running" && !isReviewAgentRunning
					? "not-started"
					: rawReviewState;
			const blockers = getBlockingStories(
				story.id,
				deps,
				currentStoryStatusMap,
			);
			const isBlocked = blockers.length > 0;

			if (
				createState === "completed" &&
				devState === "not-started" &&
				!isBlocked
			) {
				const key = `bmad-dev-story:${story.id}`;
				if (!initiatedRef.current.has(key)) {
					initiatedRef.current.add(key);
					try {
						localStorage.setItem(
							orchestratingInitiatedKey,
							JSON.stringify([...initiatedRef.current]),
						);
					} catch {
						/* storage unavailable */
					}
					const sid = story.id;
					setOrchestrationPending((prev) => new Set(prev).add(key));
					fetch("/api/workflow/run-skill", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							skill: "bmad-dev-story",
							storyId: sid,
						}),
					})
						.then((r) => {
							if (r.status === HTTP_CONFLICT) {
								initiatedRef.current.delete(key);
								try {
									localStorage.setItem(
										orchestratingInitiatedKey,
										JSON.stringify([...initiatedRef.current]),
									);
								} catch {
									/* storage unavailable */
								}
								setOrchestrationPending((prev) => {
									const next = new Set(prev);
									next.delete(key);
									return next;
								});
							} else if (!r.ok) {
								setOrchestrationPending((prev) => {
									const next = new Set(prev);
									next.delete(key);
									return next;
								});
								setBulkError(`Failed to start dev for ${sid}: ${r.status}`);
							}
						})
						.catch((err) => {
							initiatedRef.current.delete(key);
							try {
								localStorage.setItem(
									orchestratingInitiatedKey,
									JSON.stringify([...initiatedRef.current]),
								);
							} catch {
								/* storage unavailable */
							}
							setOrchestrationPending((prev) => {
								const next = new Set(prev);
								next.delete(key);
								return next;
							});
							setBulkError(`Failed to start dev for ${sid}: ${String(err)}`);
						});
				}
			}

			if (devState === "completed" && reviewState === "not-started") {
				const key = `bmad-code-review:${story.id}`;
				if (!initiatedRef.current.has(key)) {
					initiatedRef.current.add(key);
					try {
						localStorage.setItem(
							orchestratingInitiatedKey,
							JSON.stringify([...initiatedRef.current]),
						);
					} catch {
						/* storage unavailable */
					}
					const sid = story.id;
					setOrchestrationPending((prev) => new Set(prev).add(key));
					fetch("/api/workflow/run-skill", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							skill: "bmad-code-review",
							storyId: sid,
							autoResolve: true,
						}),
					})
						.then((r) => {
							if (r.status === HTTP_CONFLICT) {
								initiatedRef.current.delete(key);
								try {
									localStorage.setItem(
										orchestratingInitiatedKey,
										JSON.stringify([...initiatedRef.current]),
									);
								} catch {
									/* storage unavailable */
								}
								setOrchestrationPending((prev) => {
									const next = new Set(prev);
									next.delete(key);
									return next;
								});
							} else if (!r.ok) {
								setOrchestrationPending((prev) => {
									const next = new Set(prev);
									next.delete(key);
									return next;
								});
								setBulkError(`Failed to start review for ${sid}: ${r.status}`);
							}
						})
						.catch((err) => {
							initiatedRef.current.delete(key);
							try {
								localStorage.setItem(
									orchestratingInitiatedKey,
									JSON.stringify([...initiatedRef.current]),
								);
							} catch {
								/* storage unavailable */
							}
							setOrchestrationPending((prev) => {
								const next = new Set(prev);
								next.delete(key);
								return next;
							});
							setBulkError(`Failed to start review for ${sid}: ${String(err)}`);
						});
				}
			}
		}

		if (allStoriesDone && retrospectiveState === "not-started") {
			const key = "bmad-retrospective";
			if (!initiatedRef.current.has(key)) {
				initiatedRef.current.add(key);
				try {
					localStorage.setItem(
						orchestratingInitiatedKey,
						JSON.stringify([...initiatedRef.current]),
					);
				} catch {
					/* storage unavailable */
				}
				fetch("/api/workflow/run-skill", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						skill: "bmad-retrospective",
						autoResolve: true,
					}),
				})
					.then((r) => {
						if (!r.ok) {
							initiatedRef.current.delete(key);
							try {
								localStorage.setItem(
									orchestratingInitiatedKey,
									JSON.stringify([...initiatedRef.current]),
								);
							} catch {
								/* storage unavailable */
							}
							setBulkError(`Failed to start retrospective: ${r.status}`);
						}
					})
					.catch((err) => {
						initiatedRef.current.delete(key);
						try {
							localStorage.setItem(
								orchestratingInitiatedKey,
								JSON.stringify([...initiatedRef.current]),
							);
						} catch {
							/* storage unavailable */
						}
						setBulkError(`Failed to start retrospective: ${String(err)}`);
					});
			}
		}

		if (retrospectiveState === "completed") {
			setIsOrchestrating(false);
			setOrchestrationPending(new Set());
			try {
				localStorage.removeItem(orchestratingKey);
				localStorage.removeItem(orchestratingInitiatedKey);
			} catch {
				/* storage unavailable */
			}
		}
	}, [
		isOrchestrating,
		stories,
		allStoriesDone,
		retrospectiveState,
		data,
		orchestratingKey,
		orchestratingInitiatedKey,
		effectiveOverviewData,
	]);

	const doneCount = stories.filter((s) => s.status === "done").length;
	const inProgressCount = stories.filter(
		(s) =>
			s.status === "in-progress" ||
			s.status === "review" ||
			s.status === "ready-for-dev",
	).length;
	const progressPercent =
		stories.length > 0
			? Math.round((doneCount / stories.length) * PERCENT_MULTIPLIER)
			: 0;

	const computedEpicStatus =
		stories.length > 0 && doneCount === stories.length
			? "done"
			: inProgressCount > 0
				? "in-progress"
				: (data?.epic.status ?? "backlog");

	if (epicError && !data) {
		return (
			<main className="screen">
				<div className="panel" style={{ borderColor: "var(--highlight-2)" }}>
					<p className="eyebrow" style={{ color: "var(--highlight-2)" }}>
						Error
					</p>
					<p style={{ color: "var(--muted)" }}>{String(epicError)}</p>
					<Link className="ghost mt-4 inline-block" to="/">
						← Back to Home
					</Link>
				</div>
			</main>
		);
	}

	if (!data) {
		return (
			<main className="screen">
				<div className="panel">
					<p style={{ color: "var(--muted)" }}>Loading epic detail...</p>
				</div>
			</main>
		);
	}

	return (
		<main className="screen">
			{epicError && data ? (
				<div
					className="panel mb-4 py-3 px-4"
					style={{ borderColor: "var(--highlight-2)" }}
				>
					<p
						style={{
							color: "var(--highlight-2)",
							margin: 0,
							fontSize: "0.875rem",
						}}
					>
						⚠ Refresh failed — showing last known data. {String(epicError)}
					</p>
				</div>
			) : null}
			{data.parseWarning ? (
				<div
					className="panel mb-4 py-3 px-4"
					style={{ borderColor: "var(--highlight-2)" }}
				>
					<p
						style={{
							color: "var(--highlight-2)",
							margin: 0,
							fontSize: "0.875rem",
						}}
					>
						⚠ {data.parseWarning}
					</p>
				</div>
			) : null}
			<section className="panel reveal epic-header">
				<div className="epic-header-top">
					<Link className="epic-back-link" to="/develop-deliver">
						← Develop & Deliver
					</Link>
					<StatusBadge status={computedEpicStatus} />
				</div>
				<p className="eyebrow">Epic {data.epic.number}</p>
				<h1 className="epic-title">{data.epic.name || data.epic.id}</h1>
				{data.epic.description ? (
					<p className="epic-description">{data.epic.description}</p>
				) : null}
				<div className="epic-stats">
					<div className="epic-stat">
						<span className="epic-stat-value">{stories.length}</span>
						<span className="epic-stat-label">Stories</span>
					</div>
					<div className="epic-stat">
						<span className="epic-stat-value epic-stat-done">{doneCount}</span>
						<span className="epic-stat-label">Done</span>
					</div>
					<div className="epic-stat">
						<span className="epic-stat-value epic-stat-progress">
							{inProgressCount}
						</span>
						<span className="epic-stat-label">In Progress</span>
					</div>
					<div className="epic-stat">
						<span className="epic-stat-value">{progressPercent}%</span>
						<span className="epic-stat-label">Complete</span>
					</div>
				</div>
				{stories.length > 0 ? (
					<div className="epic-progress-bar">
						<div
							className="epic-progress-fill"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				) : null}
				{storiesNeedingPlan.length > 0 || showDevelopAllButton ? (
					<div className="flex gap-3 mt-5 flex-wrap items-center">
						{storiesNeedingPlan.length > 0 ? (
							<button
								className="cta"
								disabled={!IS_LOCAL_MODE || isPlanning}
								onClick={() => void handlePlanAllStories()}
								title={IS_LOCAL_MODE ? undefined : PROD_DISABLED_TITLE}
								type="button"
							>
								{isPlanning
									? `Planning… (${storiesNeedingPlan.length} stories)`
									: `Plan all stories (${storiesNeedingPlan.length})`}
							</button>
						) : null}
						{showDevelopAllButton ? (
							<button
								className={`cta${isOrchestrating ? "" : " ghost"}`}
								disabled={!IS_LOCAL_MODE || isOrchestrating}
								onClick={handleDevelopAllStories}
								style={isOrchestrating ? { opacity: 0.7 } : undefined}
								title={IS_LOCAL_MODE ? undefined : PROD_DISABLED_TITLE}
								type="button"
							>
								{isOrchestrating
									? "Developing all stories…"
									: "Develop all stories"}
							</button>
						) : null}
						{isOrchestrating ? (
							<>
								<button
									className="ghost"
									onClick={handleStopOrchestration}
									type="button"
								>
									Stop
								</button>
								<span className="subtitle" style={{ fontSize: "0.8rem" }}>
									Auto-running dev → review → retrospective
								</span>
							</>
						) : null}
					</div>
				) : null}
				{bulkError ? (
					<p className="error-banner" style={{ marginTop: "0.75rem" }}>
						{bulkError}
					</p>
				) : null}
			</section>

			<section className="panel reveal delay-1">
				<h2>Stories In This Epic</h2>
				<div className="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Story</th>
								<th>Create Story</th>
								<th>ATDD</th>
								<th>Dev Story</th>
								<th>Code Review</th>
								<th>Automate</th>
								<th>Test Review</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{filteredStories.map((story) => {
								const isPlannedOnly = story.id.endsWith("-");
								const runtimeSessions =
									effectiveOverviewData?.runtimeState?.sessions ?? [];

								if (isPlannedOnly) {
									return (
										<tr key={story.id} style={{ opacity: 0.55 }}>
											<td className="max-w-0">
												<span
													className="flex min-w-0 items-center gap-1"
													style={{ color: "var(--muted)" }}
												>
													<span className="block truncate">
														{storyDisplayLabel(story.id).trim()}
													</span>
													<span className="shrink-0 text-[0.8em]">
														(planned)
													</span>
												</span>
											</td>
											<td>
												<StatusBadge status="not-started" />
											</td>
											<td>
												<span style={{ color: "var(--muted)", opacity: 0.5 }}>
													—
												</span>
											</td>
											<td>
												<StatusBadge status="not-started" />
											</td>
											<td>
												<StatusBadge status="not-started" />
											</td>
											<td>
												<span style={{ color: "var(--muted)", opacity: 0.5 }}>
													—
												</span>
											</td>
											<td>
												<span style={{ color: "var(--muted)", opacity: 0.5 }}>
													—
												</span>
											</td>
											<td>
												<StatusBadge status="backlog" />
											</td>
										</tr>
									);
								}

								// bmad-create-story state with running session check
								const rawCreateState =
									story.steps["bmad-create-story"] ?? "not-started";
								const isCreateAgentRunning = runtimeSessions.some(
									(s) =>
										s.storyId === story.id &&
										s.skill === "bmad-create-story" &&
										s.status === "running",
								);
								const createState = isCreateAgentRunning
									? "running"
									: rawCreateState === "running" && !isCreateAgentRunning
										? "not-started"
										: rawCreateState;

								// bmad-dev-story state with running session check
								const rawDevState =
									story.steps["bmad-dev-story"] ?? "not-started";
								const isDevAgentRunning = runtimeSessions.some(
									(s) =>
										s.storyId === story.id &&
										s.skill === "bmad-dev-story" &&
										s.status === "running",
								);
								const isDevPending = orchestrationPending.has(
									`bmad-dev-story:${story.id}`,
								);
								const devState =
									isDevAgentRunning || isDevPending
										? "running"
										: rawDevState === "running" && !isDevAgentRunning
											? "not-started"
											: rawDevState;

								// bmad-code-review state with running session check
								const rawReviewState =
									story.steps["bmad-code-review"] ?? "not-started";
								const isReviewAgentRunning = runtimeSessions.some(
									(s) =>
										s.storyId === story.id &&
										s.skill === "bmad-code-review" &&
										s.status === "running",
								);
								const isReviewPending = orchestrationPending.has(
									`bmad-code-review:${story.id}`,
								);
								const reviewState =
									isReviewAgentRunning || isReviewPending
										? "running"
										: rawReviewState === "running" && !isReviewAgentRunning
											? "not-started"
											: rawReviewState;

								const latestCreateSession = findLatestSession(
									runtimeSessions,
									story.id,
									"bmad-create-story",
								);
								const latestDevSession = findLatestSession(
									runtimeSessions,
									story.id,
									"bmad-dev-story",
								);
								const latestReviewSession = findLatestSession(
									runtimeSessions,
									story.id,
									"bmad-code-review",
								);

								const SKILL_ORDER: { skill: SkillName; state: string }[] = [
									{ skill: "bmad-create-story", state: createState },
									{ skill: "bmad-dev-story", state: devState },
									{ skill: "bmad-code-review", state: reviewState },
								];
								const nextSkillIndex = SKILL_ORDER.findIndex(
									(s) => s.state === "not-started",
								);
								const allPriorCompleted =
									nextSkillIndex >= 0 &&
									SKILL_ORDER.slice(0, nextSkillIndex).every(
										(s) => s.state === "completed",
									);
								const nextSkill =
									nextSkillIndex >= 0 && allPriorCompleted
										? SKILL_ORDER[nextSkillIndex].skill
										: null;

								const blockers = getBlockingStories(
									story.id,
									data.storyDependencies ?? {},
									storyStatusMap,
								);
								const isBlocked = blockers.length > 0;
								const blockedTooltip = `Blocked by ${blockers.join(", ")}`;

								return (
									<tr key={story.id}>
										<td className="max-w-0">
											<Link
												className="block truncate"
												params={{ storyId: story.id }}
												to="/story/$storyId"
											>
												{storyDisplayLabel(story.id)}
											</Link>
										</td>
										<td>
											<div className="step-cell">
												<StatusBadge status={createState} />
												<SessionLink session={latestCreateSession} />
												{nextSkill === "bmad-create-story" && IS_LOCAL_MODE && (
													<Link
														className="icon-button icon-button-play"
														params={{ storyId: story.id }}
														search={{ skill: "bmad-create-story", epicId }}
														title={`Prepare bmad-create-story for ${story.id}`}
														to="/prepare-story/$storyId"
													>
														<span aria-hidden="true" className="icon-glyph">
															▶
														</span>
													</Link>
												)}
												{nextSkill === "bmad-create-story" &&
													!IS_LOCAL_MODE && (
														<span
															className="icon-button icon-button-play"
															style={{ opacity: 0.4, cursor: "not-allowed" }}
															title={PROD_DISABLED_TITLE}
														>
															<span aria-hidden="true" className="icon-glyph">
																▶
															</span>
														</span>
													)}
											</div>
										</td>
										<td>
											<span style={{ color: "var(--muted)", opacity: 0.5 }}>
												—
											</span>
										</td>
										<td>
											<div className="step-cell">
												<StatusBadge status={devState} />
												<SessionLink session={latestDevSession} />
												{nextSkill === "bmad-dev-story" &&
													!isBlocked &&
													IS_LOCAL_MODE && (
														<Link
															className="icon-button icon-button-play"
															params={{ storyId: story.id }}
															search={{ skill: "bmad-dev-story", epicId }}
															title={`Prepare bmad-dev-story for ${story.id}`}
															to="/prepare-story/$storyId"
														>
															<span aria-hidden="true" className="icon-glyph">
																▶
															</span>
														</Link>
													)}
												{nextSkill === "bmad-dev-story" &&
													!isBlocked &&
													!IS_LOCAL_MODE && (
														<span
															className="icon-button icon-button-play"
															style={{ opacity: 0.4, cursor: "not-allowed" }}
															title={PROD_DISABLED_TITLE}
														>
															<span aria-hidden="true" className="icon-glyph">
																▶
															</span>
														</span>
													)}
												{nextSkill === "bmad-dev-story" && isBlocked && (
													<span
														className="icon-button icon-button-play"
														style={{ opacity: 0.4, cursor: "not-allowed" }}
														title={blockedTooltip}
													>
														<span aria-hidden="true" className="icon-glyph">
															▶
														</span>
													</span>
												)}
											</div>
										</td>
										<td>
											<div className="step-cell">
												<StatusBadge status={reviewState} />
												<SessionLink session={latestReviewSession} />
												{nextSkill === "bmad-code-review" && (
													<button
														className="icon-button icon-button-play"
														disabled={
															!IS_LOCAL_MODE ||
															pendingSkill !== null ||
															isBlocked
														}
														onClick={() =>
															void handleRunSkill("bmad-code-review", story.id)
														}
														title={
															!IS_LOCAL_MODE
																? PROD_DISABLED_TITLE
																: isBlocked
																	? blockedTooltip
																	: `Run bmad-code-review for ${story.id}`
														}
														type="button"
													>
														<span aria-hidden="true" className="icon-glyph">
															▶
														</span>
													</button>
												)}
											</div>
										</td>
										<td>
											<span style={{ color: "var(--muted)", opacity: 0.5 }}>
												—
											</span>
										</td>
										<td>
											<span style={{ color: "var(--muted)", opacity: 0.5 }}>
												—
											</span>
										</td>
										<td>
											<StatusBadge status={story.status} />
										</td>
									</tr>
								);
							})}
							{filteredStories.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										style={{
											textAlign: "center",
											padding: "2rem 0",
											color: "var(--muted)",
										}}
									>
										No stories found for this epic.
									</td>
								</tr>
							) : null}
						</tbody>
					</table>
				</div>
			</section>

			{stories.length > 0 ? (
				<section className="panel reveal delay-2">
					<h2>Run Retrospective</h2>
					<div className="step-cell">
						<StatusBadge status={retrospectiveState} />
						<SessionLink session={latestRetroSession} />
						{retrospectiveState === "not-started" && allStoriesDone ? (
							<button
								className="icon-button icon-button-play"
								disabled={!IS_LOCAL_MODE || pendingSkill !== null}
								onClick={() => void handleRunSkill("bmad-retrospective")}
								title={
									IS_LOCAL_MODE
										? `Run bmad-retrospective for epic-${epicNumber}`
										: PROD_DISABLED_TITLE
								}
								type="button"
							>
								<span aria-hidden="true" className="icon-glyph">
									▶
								</span>
							</button>
						) : null}
						{retrospectiveState === "not-started" && !allStoriesDone ? (
							<span className="subtitle">
								All stories must be completed before running the retrospective
							</span>
						) : null}
					</div>
				</section>
			) : null}

			{skillError ? <p className="error-banner">{skillError}</p> : null}
		</main>
	);
}

export const epicDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/epic/$epicId",
	component: EpicDetailPage,
});
