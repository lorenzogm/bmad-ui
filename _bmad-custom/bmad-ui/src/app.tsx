import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type {
  OrchestratorRunGroup,
  OverviewResponse,
  RuntimeSession,
} from "./types";

const HTTP_CONFLICT = 409;

const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_SECOND = 1000;
const SESSION_STATUS_FILTER_STORAGE_KEY =
  "bmad-ui-agent-sessions-status-filters-v1";
const ALL_SESSION_STATUS_FILTER = "__all__";
const SESSION_TABLE_PAGE_SIZE = 25;
const DEFAULT_SESSION_STATUS_FILTERS = [
  "planned",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

type OverviewEpic = OverviewResponse["sprintOverview"]["epics"][number];
type SessionActionKind = "start" | "abort";

type SessionActionState = {
  sessionId: string;
  action: SessionActionKind;
} | null;

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatDuration(
  startedAt: string | null,
  endedAt: string | null
): string {
  if (!startedAt) {
    return "-";
  }

  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) {
    return "-";
  }

  const endMs = endedAt ? Date.parse(endedAt) : Date.now();
  if (Number.isNaN(endMs)) {
    return "-";
  }

  const totalSeconds = Math.max(
    0,
    Math.floor((endMs - startedMs) / MILLISECONDS_PER_SECOND)
  );
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

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

function toShortStoryId(storyId: string | null): string {
  if (!storyId) {
    return "-";
  }

  const ticket = parseStoryTicket(storyId);
  const hasValidTicket =
    Number.isFinite(ticket.epic) && Number.isFinite(ticket.story);
  if (!hasValidTicket) {
    return storyId;
  }

  return `${ticket.epic}-${ticket.story}`;
}

function SessionsTable(props: {
  sessions: RuntimeSession[];
  sessionActionPending: SessionActionState;
  onStartSession: (sessionId: string) => void;
  onAbortSession: (sessionId: string) => void;
}) {
  const { sessions, sessionActionPending, onAbortSession, onStartSession } =
    props;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Story</th>
            <th>Skill</th>
            <th>Model</th>
            <th>Status</th>
            <th>Started</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const hasPendingAction = sessionActionPending !== null;
            const isRowActionPending =
              sessionActionPending?.sessionId === session.id;
            const canStart = session.status === "planned";
            const canAbort =
              session.status === "planned" || session.status === "running";

            return (
              <tr key={session.id}>
                <td>{toShortStoryId(session.storyId)}</td>
                <td>
                  <Link
                    params={{ sessionId: session.id }}
                    to="/session/$sessionId"
                  >
                    {session.skill}
                  </Link>
                </td>
                <td>{session.model}</td>
                <td>
                  <span className={`step-badge step-${session.status}`}>
                    {session.status}
                  </span>
                </td>
                <td>{formatDate(session.startedAt)}</td>
                <td>{formatDuration(session.startedAt, session.endedAt)}</td>
                <td>
                  <div className="session-actions" role="group">
                    <button
                      aria-label="Start session"
                      className="icon-button icon-button-play"
                      disabled={hasPendingAction || !canStart}
                      onClick={() => onStartSession(session.id)}
                      title="Start session"
                      type="button"
                    >
                      <span aria-hidden="true" className="icon-glyph">
                        ▶
                      </span>
                    </button>
                    <button
                      aria-label="Abort session"
                      className="icon-button icon-button-delete"
                      disabled={hasPendingAction || !canAbort}
                      onClick={() => onAbortSession(session.id)}
                      title="Abort session"
                      type="button"
                    >
                      <span aria-hidden="true" className="icon-glyph">
                        ✕
                      </span>
                    </button>
                    {isRowActionPending ? (
                      <span className="stage-state-pill">working...</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={7}>No sessions for selected filters</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AgentSessionsSection(props: {
  runGroups: OrchestratorRunGroup[];
  sessionActionPending: SessionActionState;
  onStartSession: (sessionId: string) => void;
  onAbortSession: (sessionId: string) => void;
}) {
  const { runGroups, sessionActionPending, onAbortSession, onStartSession } =
    props;
  const [page, setPage] = useState(0);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    ALL_SESSION_STATUS_FILTER,
  ]);

  const allSessions = useMemo(
    () => runGroups.flatMap((group) => group.sessions),
    [runGroups]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(
        SESSION_STATUS_FILTER_STORAGE_KEY
      );
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }

      const next = parsed.filter(
        (item): item is string => typeof item === "string"
      );
      if (next.length > 0) {
        setSelectedStatuses(next);
      }
    } catch {
      // Ignore malformed persisted filters.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SESSION_STATUS_FILTER_STORAGE_KEY,
      JSON.stringify(selectedStatuses)
    );
  }, [selectedStatuses]);

  const availableStatuses = useMemo(() => {
    const known = [...DEFAULT_SESSION_STATUS_FILTERS];
    const discovered = allSessions
      .map((session) => session.status)
      .filter((status) => !known.includes(status as (typeof known)[number]))
      .sort((a, b) => a.localeCompare(b));

    return [...known, ...discovered];
  }, [allSessions]);

  useEffect(() => {
    setSelectedStatuses((current) => {
      if (current.includes(ALL_SESSION_STATUS_FILTER)) {
        return [ALL_SESSION_STATUS_FILTER];
      }

      const normalized = current.filter((status) =>
        availableStatuses.includes(status)
      );

      if (normalized.length === 0) {
        return [ALL_SESSION_STATUS_FILTER];
      }

      if (normalized.length !== current.length) {
        return normalized;
      }

      return current;
    });
  }, [availableStatuses]);

  const isAllSelected = selectedStatuses.includes(ALL_SESSION_STATUS_FILTER);

  const filteredSessions = useMemo(() => {
    if (isAllSelected) {
      return allSessions;
    }

    return allSessions.filter((session) =>
      selectedStatuses.includes(session.status)
    );
  }, [allSessions, isAllSelected, selectedStatuses]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSessions.length / SESSION_TABLE_PAGE_SIZE)
  );

  useEffect(() => {
    setPage((current) => {
      const maxPage = Math.max(0, totalPages - 1);
      return current > maxPage ? maxPage : current;
    });
  }, [totalPages]);

  const paginatedSessions = useMemo(() => {
    const start = page * SESSION_TABLE_PAGE_SIZE;
    return filteredSessions.slice(start, start + SESSION_TABLE_PAGE_SIZE);
  }, [filteredSessions, page]);

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses((current) => {
      if (status === ALL_SESSION_STATUS_FILTER) {
        return [ALL_SESSION_STATUS_FILTER];
      }

      if (current.includes(ALL_SESSION_STATUS_FILTER)) {
        return [status];
      }

      if (current.includes(status)) {
        if (current.length === 1) {
          return [ALL_SESSION_STATUS_FILTER];
        }
        return current.filter((item) => item !== status);
      }

      return [...current, status];
    });
  };

  return (
    <section className="panel reveal delay-2">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Agent Sessions</h2>
        {filteredSessions.length > SESSION_TABLE_PAGE_SIZE ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              className="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              type="button"
            >
              ← Newer
            </button>
            <span className="eyebrow">
              Page {page + 1} / {totalPages}
            </span>
            <button
              className="ghost"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              type="button"
            >
              Older →
            </button>
          </div>
        ) : null}
      </div>

      <div className="session-status-filters">
        <span className="session-status-filters-label">Status filters</span>
        {[ALL_SESSION_STATUS_FILTER, ...availableStatuses].map((status) => {
          const isAll = status === ALL_SESSION_STATUS_FILTER;
          const isSelected = isAll
            ? isAllSelected
            : selectedStatuses.includes(status);
          const label = isAll ? "All" : status;
          return (
            <button
              aria-pressed={isSelected}
              className={`session-status-filter-btn ${isSelected ? "is-active" : "is-inactive"}`}
              key={status}
              onClick={() => toggleStatusFilter(status)}
              type="button"
            >
              <span
                className={`step-badge ${isAll ? "step-all" : `step-${status}`}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {allSessions.length > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <span className="eyebrow">
              Total: {filteredSessions.length} sessions
            </span>
            <span className="eyebrow">Per page: {SESSION_TABLE_PAGE_SIZE}</span>
          </div>
          <SessionsTable
            onAbortSession={onAbortSession}
            onStartSession={onStartSession}
            sessionActionPending={sessionActionPending}
            sessions={paginatedSessions}
          />
        </>
      ) : (
        <p className="subtitle">No orchestrator runs recorded yet.</p>
      )}
    </section>
  );
}

type WorkflowStep = {
  id: string;
  name: string;
  icon: string;
  isOptional: boolean;
  filePatterns: string[];
  isCompleted: boolean;
  skill: string;
};

type WorkflowStatus = {
  steps: WorkflowStep[];
  nextActionStep: WorkflowStep | null;
};

function detectWorkflowStatus(artifactFiles: string[]): WorkflowStatus {
  const steps: WorkflowStep[] = [
    {
      id: "prd",
      name: "Product Requirements",
      icon: "📋",
      isOptional: false,
      filePatterns: ["prd.md"],
      isCompleted: artifactFiles.some((f) => f === "prd.md"),
      skill: "bmad-create-prd",
    },
    {
      id: "architecture",
      name: "Architecture Design",
      icon: "🏗️",
      isOptional: false,
      filePatterns: ["architecture.md"],
      isCompleted: artifactFiles.some((f) => f === "architecture.md"),
      skill: "bmad-create-architecture",
    },
    {
      id: "ux",
      name: "UX Design",
      icon: "🎨",
      isOptional: true,
      filePatterns: ["ux.md", "ux-design.md"],
      isCompleted: artifactFiles.some((f) =>
        f.includes("ux") && f.endsWith(".md")
      ),
      skill: "bmad-create-ux-design",
    },
    {
      id: "epics",
      name: "Epics & Stories",
      icon: "📖",
      isOptional: false,
      filePatterns: ["epics.md"],
      isCompleted: artifactFiles.some((f) => f === "epics.md"),
      skill: "bmad-create-epics-and-stories",
    },
    {
      id: "readiness",
      name: "Implementation Readiness",
      icon: "✓",
      isOptional: false,
      filePatterns: ["readiness"],
      isCompleted: artifactFiles.some((f) =>
        f.toLowerCase().includes("readiness")
      ),
      skill: "bmad-check-implementation-readiness",
    },
    {
      id: "sprint",
      name: "Sprint Planning",
      icon: "⚡",
      isOptional: false,
      filePatterns: ["sprint"],
      isCompleted: artifactFiles.some((f) =>
        f.toLowerCase().includes("sprint")
      ),
      skill: "bmad-sprint-planning",
    },
  ];

  let nextActionStep: WorkflowStep | null = null;

  for (const step of steps) {
    if (!step.isCompleted) {
      nextActionStep = step;
      break;
    }
  }

  return { steps, nextActionStep };
}

function BMADWorkflowSection(props: { artifactFiles: string[] }) {
  const { artifactFiles } = props;
  const { steps, nextActionStep } = detectWorkflowStatus(artifactFiles);

  const handlePlayClick = (step: WorkflowStep) => {
    const command = `gh copilot suggest -t shell "${step.skill}"`;
    try {
      navigator.clipboard.writeText(command);
    } catch (_err) {
      // clipboard not available
    }
    alert(`Command copied!\n\nRun in your terminal:\n\n${command}`);
  };

  return (
    <section className="panel reveal delay-1">
      <h2>BMAD Workflow</h2>
      <p className="subtitle">
        Steps to complete your project. The next required action has a play
        button — click to copy the command to your clipboard.
      </p>

      <div className="workflow-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`workflow-step${step.isCompleted ? " workflow-step-done" : ""}${nextActionStep?.id === step.id ? " workflow-step-next" : ""}`}
          >
            <span className="workflow-step-icon" aria-hidden="true">
              {step.icon}
            </span>
            <div className="workflow-step-body">
              <span className="workflow-step-name">{step.name}</span>
              {step.isOptional && (
                <span className="workflow-step-optional">optional</span>
              )}
            </div>
            <span
              className={`step-badge ${step.isCompleted ? "step-done" : "step-not-started"}`}
            >
              {step.isCompleted ? "done" : "pending"}
            </span>
            {nextActionStep?.id === step.id && (
              <button
                className="icon-button icon-button-play"
                onClick={() => handlePlayClick(step)}
                title={`Copy command to run ${step.skill}`}
                type="button"
              >
                <span aria-hidden="true" className="icon-glyph">
                  ▶
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function EpicTableSection(props: {
  filteredEpics: OverviewEpic[];
  epicLabels: Map<string, string>;
  hideFinishedEpics: boolean;
  onToggleHideFinishedEpics: (checked: boolean) => void;
}) {
  const {
    filteredEpics,
    epicLabels,
    hideFinishedEpics,
    onToggleHideFinishedEpics,
  } = props;

  return (
    <section className="panel reveal delay-3">
      <h2>Epic Table</h2>
      <label className="filter-toggle">
        <input
          checked={hideFinishedEpics}
          onChange={(event) => onToggleHideFinishedEpics(event.target.checked)}
          type="checkbox"
        />
        Hide 100% finished epics
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Epic</th>
              <th>Name</th>
              <th>Planning</th>
              <th>Status</th>
              <th>Retrospective</th>
              <th>Stories</th>
            </tr>
          </thead>
          <tbody>
            {filteredEpics.map((epic) => (
              <tr key={epic.id}>
                <td>
                  <Link params={{ epicId: epic.id }} to="/epic/$epicId">
                    {epic.id}
                  </Link>
                </td>
                <td>{epicLabels.get(epic.id) ?? "-"}</td>
                <td>
                  <span
                    className={`step-badge step-${epic.lifecycleSteps["bmad-sprint-planning"]}`}
                  >
                    {epic.lifecycleSteps["bmad-sprint-planning"]}
                  </span>
                </td>
                <td>
                  <span className={`step-badge step-${epic.status}`}>
                    {epic.status}
                  </span>
                </td>
                <td>
                  <span
                    className={`step-badge step-${epic.lifecycleSteps["bmad-retrospective"]}`}
                  >
                    {epic.lifecycleSteps["bmad-retrospective"]}
                  </span>
                </td>
                <td>{epic.storyCount}</td>
              </tr>
            ))}
            {filteredEpics.length === 0 ? (
              <tr>
                <td colSpan={6}>No epics found in sprint status</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function isEpicFullyFinished(epic: OverviewEpic) {
  return (
    epic.status === "done" &&
    epic.lifecycleSteps["bmad-retrospective"] === "completed"
  );
}

export function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionActionPending, setSessionActionPending] =
    useState<SessionActionState>(null);
  const [artifactFiles, setArtifactFiles] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;

    const applyPayload = (payload: OverviewResponse) => {
      if (!mounted) {
        return;
      }

      setData(payload);
      setError(null);
      setLoading(false);
    };

    const load = async () => {
      try {
        const response = await fetch("/api/overview");
        if (!response.ok) {
          throw new Error(`overview request failed: ${response.status}`);
        }
        applyPayload((await response.json()) as OverviewResponse);
      } catch (fetchError) {
        if (mounted) {
          setError(String(fetchError));
          setLoading(false);
        }
      }
    };

    load();

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource("/api/events/overview");
      eventSource.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as OverviewResponse);
        } catch (parseError) {
          if (mounted) {
            setError(String(parseError));
          }
        }
      };
    }

    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchArtifactFiles = async () => {
      try {
        const response = await fetch("/api/artifacts/files");
        if (!response.ok) {
          throw new Error(`artifacts request failed: ${response.status}`);
        }
        const files = (await response.json()) as string[];
        if (mounted) {
          setArtifactFiles(files);
        }
      } catch (fetchError) {
        console.error("Failed to fetch artifact files:", fetchError);
        if (mounted) {
          setArtifactFiles([]);
        }
      }
    };

    fetchArtifactFiles();

    return () => {
      mounted = false;
    };
  }, []);

  const runGroups = useMemo<OrchestratorRunGroup[]>(() => {
    const history = data?.orchestratorHistory ?? [];
    const currentSessions = data?.runtimeState?.sessions ?? [];

    if (currentSessions.length === 0 && history.length === 0) {
      return [];
    }

    const currentGroup: OrchestratorRunGroup | null =
      currentSessions.length > 0
        ? {
            id: "run-current",
            startedAt:
              data?.runtimeState?.startedAt ?? new Date().toISOString(),
            endedAt:
              data?.runtimeState?.status === "running"
                ? null
                : (currentSessions
                    .map((s) => s.endedAt)
                    .filter((t): t is string => t !== null)
                    .sort()
                    .at(-1) ?? null),
            sessions: [...currentSessions].sort((a, b) =>
              a.startedAt < b.startedAt ? 1 : -1
            ),
          }
        : null;

    const historyGroups = history.map((g) => ({
      ...g,
      sessions: [...g.sessions].sort((a, b) =>
        a.startedAt < b.startedAt ? 1 : -1
      ),
    }));

    return currentGroup ? [currentGroup, ...historyGroups] : historyGroups;
  }, [data]);

  const startSession = async (sessionId: string) => {
    setSessionActionPending({ sessionId, action: "start" });
    try {
      const response = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/start`,
        {
          method: "POST",
        }
      );
      if (!response.ok && response.status !== HTTP_CONFLICT) {
        throw new Error(`start failed: ${response.status}`);
      }
    } catch (sessionStartError) {
      setError(String(sessionStartError));
    } finally {
      setSessionActionPending(null);
    }
  };

  const abortSession = async (sessionId: string) => {
    setSessionActionPending({ sessionId, action: "abort" });
    try {
      const response = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/abort`,
        {
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error(`abort failed: ${response.status}`);
      }
    } catch (sessionAbortError) {
      setError(String(sessionAbortError));
    } finally {
      setSessionActionPending(null);
    }
  };

  if (loading || (error && !data)) {
    return (
      <main className="screen loading">
        {loading ? "Loading BMAD dashboard..." : error}
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="hero panel reveal">
        <h2>Dashboard Overview</h2>
        <p className="eyebrow">BMAD Dashboard</p>
        <h1>Copilot Multi-Agent Dashboard</h1>
        <p className="subtitle">
          Live overview of sprint progression, active sessions, and key BMAD
          artifacts.
        </p>
      </section>

      <BMADWorkflowSection artifactFiles={artifactFiles} />

      <AgentSessionsSection
        onAbortSession={abortSession}
        onStartSession={startSession}
        runGroups={runGroups}
        sessionActionPending={sessionActionPending}
      />

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  );
}
