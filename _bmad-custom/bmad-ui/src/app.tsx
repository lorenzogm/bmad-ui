import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type {
  OrchestratorRunGroup,
  OverviewResponse,
  RuntimeSession,
} from "./types";

const HTTP_CONFLICT = 409;

const STORY_COLUMN_WIDTH = 150;
const GRAPH_LANE_SPACING = 64;
const GRAPH_MIN_HEIGHT = 248;
const GRAPH_MIN_WIDTH = 980;
const GRAPH_END_PADDING = 190;
const GRAPH_VERTICAL_PADDING = 60;
const GRAPH_SELECTED_EPIC_LABEL_OFFSET_X = 26;
const GRAPH_STAGE_TITLE_OFFSET_Y = 42;
const GRAPH_EDGE_CURVE_DELTA = 24;
const GRAPH_ACTION_FO_WIDTH = 88;
const GRAPH_ACTION_FO_HEIGHT = 34;
const GRAPH_ACTION_OFFSET_X = 44;
const GRAPH_ACTION_OFFSET_Y = 34;
const GRAPH_STORY_CHIP_OFFSET_X = 22;
const GRAPH_STORY_CHIP_OFFSET_Y = 26;
const GRAPH_STORY_CHIP_WIDTH = 44;
const GRAPH_STORY_CHIP_HEIGHT = 24;
const GRAPH_STAGE_HALO_RADIUS = 28;
const GRAPH_STAGE_NODE_RADIUS = 18;
const GRAPH_STORY_HALO_RADIUS = 21;
const GRAPH_STORY_NODE_RADIUS = 14;
const INDEPENDENT_COLUMN_BATCH = 3;
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

type OverviewStory = OverviewResponse["sprintOverview"]["stories"][number];
type OverviewEpic = OverviewResponse["sprintOverview"]["epics"][number];
type StoryGraphRow = {
  story: OverviewStory;
  x: number;
  y: number;
  canStartNow: boolean;
  isActiveNow: boolean;
  blockedBy: string[];
};

type StoryDependencyGraph = {
  selectedEpicId: string | null;
  selectedEpicNumber: number | null;
  emptyMessage: string;
  planningState: OverviewEpic["lifecycleSteps"]["bmad-sprint-planning"];
  retrospectiveState: OverviewEpic["lifecycleSteps"]["bmad-retrospective"];
  rows: StoryGraphRow[];
  edges: Array<{ from: string; to: string }>;
  laneY: number;
  planningX: number;
  retrospectiveX: number;
  width: number;
  height: number;
};

type RunEpicStage = (stage: "planning" | "retrospective") => Promise<void>;
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

function findGraphParticipants(
  epicStories: OverviewStory[],
  storyDependencies: Record<string, string[]>,
  epicStoryIds: Set<string>
): Set<string> {
  const inGraph = new Set<string>();
  for (const story of epicStories) {
    const deps = (storyDependencies[story.id] || []).filter((id) =>
      epicStoryIds.has(id)
    );
    if (deps.length > 0) {
      inGraph.add(story.id);
      for (const dep of deps) {
        inGraph.add(dep);
      }
    }
  }
  return inGraph;
}

function computeStoryDepth(
  storyId: string,
  storyDependencies: Record<string, string[]>,
  epicStoryIds: Set<string>,
  memo: Map<string, number>
): number {
  if (memo.has(storyId)) {
    return memo.get(storyId) as number;
  }
  const deps = (storyDependencies[storyId] || []).filter((id) =>
    epicStoryIds.has(id)
  );
  if (deps.length === 0) {
    memo.set(storyId, 0);
    return 0;
  }
  const maxDep = Math.max(
    ...deps.map((d) =>
      computeStoryDepth(d, storyDependencies, epicStoryIds, memo)
    )
  );
  const depth = maxDep + 1;
  memo.set(storyId, depth);
  return depth;
}

type StoryPosition = { x: number; y: number };

function buildColumnLayout(
  epicStories: OverviewStory[],
  storyDependencies: Record<string, string[]>,
  storiesStartX: number
): {
  positions: Map<string, StoryPosition>;
  columnCount: number;
  maxLaneCount: number;
} {
  const epicStoryIds = new Set(epicStories.map((s) => s.id));
  const inGraph = findGraphParticipants(
    epicStories,
    storyDependencies,
    epicStoryIds
  );

  const graphStories = epicStories.filter((s) => inGraph.has(s.id));
  const independentStories = epicStories.filter((s) => !inGraph.has(s.id));

  // Compute topological depth for graph-connected stories
  const depthMemo = new Map<string, number>();
  for (const s of graphStories) {
    computeStoryDepth(s.id, storyDependencies, epicStoryIds, depthMemo);
  }
  const maxDepth =
    graphStories.length > 0 ? Math.max(...[...depthMemo.values()]) : -1;

  // Build columns: graph stories grouped by depth, then independent batches
  const columns: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    columns.push(
      graphStories.filter((s) => depthMemo.get(s.id) === d).map((s) => s.id)
    );
  }
  for (
    let i = 0;
    i < independentStories.length;
    i += INDEPENDENT_COLUMN_BATCH
  ) {
    columns.push(
      independentStories.slice(i, i + INDEPENDENT_COLUMN_BATCH).map((s) => s.id)
    );
  }

  // Assign x,y positions: x by column index, y spread within column
  const positions = new Map<string, StoryPosition>();
  let maxLaneCount = 1;
  for (let col = 0; col < columns.length; col++) {
    const group = columns[col];
    if (group.length > maxLaneCount) {
      maxLaneCount = group.length;
    }
    const centerOffset = (group.length - 1) / 2;
    const x = storiesStartX + col * STORY_COLUMN_WIDTH;
    for (let row = 0; row < group.length; row++) {
      const laneOffset = row - centerOffset;
      positions.set(group[row], { x, y: laneOffset * GRAPH_LANE_SPACING });
    }
  }

  return { positions, columnCount: columns.length, maxLaneCount };
}

function createEmptyDependencyGraph(): StoryDependencyGraph {
  return {
    selectedEpicId: null,
    selectedEpicNumber: null,
    emptyMessage:
      "Dependencies are not available yet. Run sprint planning to generate the story graph.",
    planningState: "not-started",
    retrospectiveState: "not-started",
    rows: [],
    edges: [],
    laneY: GRAPH_VERTICAL_PADDING,
    planningX: 84,
    retrospectiveX: 0,
    width: 0,
    height: 0,
  };
}

function resolveTransitiveDependencies(
  storyId: string,
  storyDependencies: Record<string, string[]>,
  memo = new Map<string, string[]>(),
  visiting = new Set<string>()
): string[] {
  if (memo.has(storyId)) {
    return memo.get(storyId) || [];
  }

  if (visiting.has(storyId)) {
    return [];
  }

  visiting.add(storyId);

  const directDeps = storyDependencies[storyId] || [];
  const resolved = new Set(directDeps);

  for (const depId of directDeps) {
    const nestedDeps = resolveTransitiveDependencies(
      depId,
      storyDependencies,
      memo,
      visiting
    );
    for (const nestedDepId of nestedDeps) {
      resolved.add(nestedDepId);
    }
  }

  visiting.delete(storyId);

  const result = Array.from(resolved);
  memo.set(storyId, result);
  return result;
}

function createStoryGraphRow(
  story: OverviewStory,
  epicStories: OverviewStory[],
  storyX: number,
  storyY: number,
  storyIndex: number,
  edges: Array<{ from: string; to: string }>,
  storyDependencies: Record<string, string[]>
): StoryGraphRow {
  const depIds = storyDependencies[story.id] || [];
  const transitiveDepIds = resolveTransitiveDependencies(
    story.id,
    storyDependencies
  );
  const epicStoryIds = new Set(epicStories.map((s) => s.id));
  const relevantDeps = depIds.filter((id) => epicStoryIds.has(id));
  const relevantTransitiveDeps = transitiveDepIds.filter((id) =>
    epicStoryIds.has(id)
  );
  const storyOrder = new Map(
    epicStories.map((candidate, index) => [candidate.id, index])
  );

  const blockedBySet = new Set(
    relevantTransitiveDeps.filter((depId) => {
      const depStory = epicStories.find((s) => s.id === depId);
      return depStory && depStory.status !== "done";
    })
  );

  for (const depId of relevantDeps) {
    edges.push({ from: depId, to: story.id });
  }

  // If no explicit dependencies, fall back to linear chain for graph display
  if (relevantDeps.length === 0 && storyIndex > 0) {
    const prevStory = epicStories[storyIndex - 1];
    edges.push({ from: prevStory.id, to: story.id });
    if (prevStory.status !== "done") {
      blockedBySet.add(prevStory.id);
    }
  }

  const blockedBy = Array.from(blockedBySet).sort(
    (left, right) => (storyOrder.get(left) || 0) - (storyOrder.get(right) || 0)
  );

  return {
    story,
    x: storyX,
    y: storyY,
    canStartNow:
      blockedBy.length === 0 &&
      (story.status === "backlog" || story.status === "ready-for-dev"),
    isActiveNow: story.status === "in-progress" || story.status === "review",
    blockedBy,
  };
}

function getGraphNodeStateClass(state: string) {
  switch (state) {
    case "done":
    case "completed":
      return "graph-node-completed";
    case "in-progress":
    case "review":
    case "running":
      return "graph-node-running";
    default:
      return "graph-node-not-started";
  }
}

function DependencyGraph(props: {
  graph: StoryDependencyGraph;
  actionPending: boolean;
  epicActionPending: "planning" | "retrospective" | null;
  onRunEpicStage: RunEpicStage;
  planningLabel: string;
  retrospectiveLabel: string;
}) {
  const {
    actionPending,
    epicActionPending,
    graph,
    onRunEpicStage,
    planningLabel,
    retrospectiveLabel,
  } = props;

  if (graph.rows.length === 0) {
    return <p className="tree-hint">{graph.emptyMessage}</p>;
  }

  const planningStateClass = getGraphNodeStateClass(graph.planningState);
  const retrospectiveStateClass = getGraphNodeStateClass(
    graph.retrospectiveState
  );

  return (
    <div className="dependency-tree" role="img">
      <p className="tree-hint">
        Showing stories for {graph.selectedEpicId}. If multiple epics are in
        progress, this view uses the first one.
      </p>
      <div className="branch-graph-wrap">
        <svg
          className="branch-graph branch-graph-global"
          role="img"
          viewBox={`0 0 ${graph.width} ${graph.height}`}
        >
          <title>Epic dependency graph</title>
          <line
            className="graph-line graph-lane"
            x1={graph.planningX}
            x2={graph.retrospectiveX}
            y1={graph.laneY}
            y2={graph.laneY}
          />
          <text
            className="graph-label"
            x={graph.planningX - GRAPH_SELECTED_EPIC_LABEL_OFFSET_X}
            y={40}
          >
            {graph.selectedEpicId}
          </text>

          {graph.edges.map((edge, index) => {
            const from = graph.rows.find((row) => row.story.id === edge.from);
            const to = graph.rows.find((row) => row.story.id === edge.to);

            if (!(from && to)) {
              return null;
            }

            return (
              <path
                className="graph-edge"
                d={`M ${from.x} ${from.y} C ${from.x + GRAPH_EDGE_CURVE_DELTA} ${from.y}, ${to.x - GRAPH_EDGE_CURVE_DELTA} ${to.y}, ${to.x} ${to.y}`}
                key={`${edge.from}-${edge.to}-${index}`}
              />
            );
          })}

          <g>
            <circle
              className="graph-node-halo graph-node-halo-planning"
              cx={graph.planningX}
              cy={graph.laneY}
              r={GRAPH_STAGE_HALO_RADIUS}
            />
            <circle
              className={`graph-node ${planningStateClass}`}
              cx={graph.planningX}
              cy={graph.laneY}
              r={GRAPH_STAGE_NODE_RADIUS}
            />
            <text
              className="graph-stage-title"
              textAnchor="middle"
              x={graph.planningX}
              y={graph.laneY - GRAPH_STAGE_TITLE_OFFSET_Y}
            >
              Planning
            </text>
            <foreignObject
              className="graph-node-action-fo"
              height={GRAPH_ACTION_FO_HEIGHT}
              width={GRAPH_ACTION_FO_WIDTH}
              x={graph.planningX - GRAPH_ACTION_OFFSET_X}
              y={graph.laneY + GRAPH_ACTION_OFFSET_Y}
            >
              <div className="graph-node-action-wrap">
                <button
                  className="ghost stage-mini-btn"
                  disabled={
                    actionPending ||
                    epicActionPending !== null ||
                    graph.selectedEpicId === null
                  }
                  onClick={() => onRunEpicStage("planning")}
                  type="button"
                >
                  {planningLabel}
                </button>
              </div>
            </foreignObject>
          </g>

          {graph.rows.map((row) => {
            const shortId = toShortStoryId(row.story.id);
            const stateClass = getGraphNodeStateClass(row.story.status);

            return (
              <g key={row.story.id}>
                <circle
                  className={`graph-node-halo ${stateClass}`}
                  cx={row.x}
                  cy={row.y}
                  r={GRAPH_STORY_HALO_RADIUS}
                />
                <circle
                  className={`graph-node ${stateClass} ${row.canStartNow ? "graph-node-startable" : ""} ${row.isActiveNow ? "graph-node-active" : ""}`}
                  cx={row.x}
                  cy={row.y}
                  r={GRAPH_STORY_NODE_RADIUS}
                />

                <foreignObject
                  height={GRAPH_STORY_CHIP_HEIGHT}
                  width={GRAPH_STORY_CHIP_WIDTH}
                  x={row.x - GRAPH_STORY_CHIP_OFFSET_X}
                  y={row.y + GRAPH_STORY_CHIP_OFFSET_Y}
                >
                  <div className="graph-story-chip">{shortId}</div>
                </foreignObject>
              </g>
            );
          })}

          <g>
            <circle
              className="graph-node-halo graph-node-halo-retro"
              cx={graph.retrospectiveX}
              cy={graph.laneY}
              r={GRAPH_STAGE_HALO_RADIUS}
            />
            <circle
              className={`graph-node ${retrospectiveStateClass}`}
              cx={graph.retrospectiveX}
              cy={graph.laneY}
              r={GRAPH_STAGE_NODE_RADIUS}
            />
            <text
              className="graph-stage-title"
              textAnchor="middle"
              x={graph.retrospectiveX}
              y={graph.laneY - GRAPH_STAGE_TITLE_OFFSET_Y}
            >
              Retro
            </text>
            <foreignObject
              className="graph-node-action-fo"
              height={GRAPH_ACTION_FO_HEIGHT}
              width={GRAPH_ACTION_FO_WIDTH}
              x={graph.retrospectiveX - GRAPH_ACTION_OFFSET_X}
              y={graph.laneY + GRAPH_ACTION_OFFSET_Y}
            >
              <div className="graph-node-action-wrap">
                <button
                  className="ghost stage-mini-btn"
                  disabled={
                    actionPending ||
                    epicActionPending !== null ||
                    graph.selectedEpicId === null
                  }
                  onClick={() => onRunEpicStage("retrospective")}
                  type="button"
                >
                  {retrospectiveLabel}
                </button>
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>
    </div>
  );
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

function OrchestratorControlsSection(props: {
  actionPending: boolean;
  orchestratorRunning: boolean;
  onRunOrchestrator: () => void;
  onStopOrchestrator: () => void;
  epicActionPending: "planning" | "retrospective" | null;
  storyDependencyGraph: StoryDependencyGraph;
  onRunEpicStage: RunEpicStage;
  planningLabel: string;
  retrospectiveLabel: string;
}) {
  const {
    actionPending,
    orchestratorRunning,
    onRunOrchestrator,
    onStopOrchestrator,
    epicActionPending,
    storyDependencyGraph,
    onRunEpicStage,
    planningLabel,
    retrospectiveLabel,
  } = props;

  return (
    <section className="panel reveal delay-1">
      <h2>Orchestrator Controls</h2>
      <p className="subtitle">
        Queue planning or retrospective sessions, then start each one manually
        from Agent Sessions.
      </p>
      <div className="hero-actions">
        <button
          className="cta"
          disabled={actionPending || orchestratorRunning}
          onClick={onRunOrchestrator}
          type="button"
        >
          Start Orchestrator
        </button>
        <button
          className="ghost"
          disabled={actionPending || !orchestratorRunning}
          onClick={onStopOrchestrator}
          type="button"
        >
          Stop
        </button>
        <span className="runtime-pill">
          {orchestratorRunning ? "Agent Runner: Active" : "Agent Runner: Idle"}
        </span>
      </div>

      <DependencyGraph
        actionPending={actionPending}
        epicActionPending={epicActionPending}
        graph={storyDependencyGraph}
        onRunEpicStage={onRunEpicStage}
        planningLabel={planningLabel}
        retrospectiveLabel={retrospectiveLabel}
      />
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

function buildStoryDependencyGraph(
  data: OverviewResponse | null
): StoryDependencyGraph {
  const allStories = data?.sprintOverview.stories || [];
  const storyDependencies = data?.storyDependencies || {};
  const selectedEpic = (data?.sprintOverview.epics || [])
    .filter((epic) => epic.status === "in-progress")
    .sort((a, b) => a.number - b.number)[0];

  if (!selectedEpic) {
    return createEmptyDependencyGraph();
  }

  if (selectedEpic.lifecycleSteps["bmad-sprint-planning"] !== "completed") {
    return {
      ...createEmptyDependencyGraph(),
      selectedEpicId: selectedEpic.id,
      selectedEpicNumber: selectedEpic.number,
      planningState: selectedEpic.lifecycleSteps["bmad-sprint-planning"],
      retrospectiveState: selectedEpic.lifecycleSteps["bmad-retrospective"],
      emptyMessage:
        "Dependencies are missing for this epic. Queue sprint planning and then click Play in Agent Sessions.",
    };
  }

  const epicStories = allStories
    .filter((story) => parseStoryTicket(story.id).epic === selectedEpic.number)
    .sort(
      (a, b) => parseStoryTicket(a.id).story - parseStoryTicket(b.id).story
    );

  const planningX = 84;
  const storiesStartX = planningX + STORY_COLUMN_WIDTH;
  const { positions, columnCount, maxLaneCount } = buildColumnLayout(
    epicStories,
    storyDependencies,
    storiesStartX
  );

  // Compute centerY so that lane offset 0 sits in the vertical center
  const centerY =
    GRAPH_VERTICAL_PADDING + ((maxLaneCount - 1) / 2) * GRAPH_LANE_SPACING;
  const graphHeight = Math.max(
    GRAPH_MIN_HEIGHT,
    maxLaneCount * GRAPH_LANE_SPACING + GRAPH_VERTICAL_PADDING * 2
  );

  const edges: Array<{ from: string; to: string }> = [];
  const rows = epicStories.map((story, storyIndex) => {
    const pos = positions.get(story.id) ?? { x: storiesStartX, y: 0 };
    return createStoryGraphRow(
      story,
      epicStories,
      pos.x,
      centerY + pos.y,
      storyIndex,
      edges,
      storyDependencies
    );
  });
  const retrospectiveX = storiesStartX + columnCount * STORY_COLUMN_WIDTH;

  return {
    selectedEpicId: selectedEpic.id,
    selectedEpicNumber: selectedEpic.number,
    emptyMessage: "",
    planningState: selectedEpic.lifecycleSteps["bmad-sprint-planning"],
    retrospectiveState: selectedEpic.lifecycleSteps["bmad-retrospective"],
    rows,
    edges,
    laneY: centerY,
    planningX,
    retrospectiveX,
    width: Math.max(GRAPH_MIN_WIDTH, retrospectiveX + GRAPH_END_PADDING),
    height: graphHeight,
  };
}

async function postOrchestratorAction(
  url: string,
  errorMessage: string,
  payload?: unknown
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok && response.status !== HTTP_CONFLICT) {
    throw new Error(`${errorMessage}: ${response.status}`);
  }
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
  const [actionPending, setActionPending] = useState(false);
  const [epicActionPending, setEpicActionPending] = useState<
    "planning" | "retrospective" | null
  >(null);
  const [sessionActionPending, setSessionActionPending] =
    useState<SessionActionState>(null);

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

  const storyDependencyGraph = useMemo(
    () => buildStoryDependencyGraph(data),
    [data]
  );

  const runOrchestrator = async () => {
    setActionPending(true);
    try {
      await postOrchestratorAction("/api/orchestrator/run", "run failed", {
        nonInteractive: true,
      });
    } catch (runError) {
      setError(String(runError));
    } finally {
      setActionPending(false);
    }
  };

  const stopOrchestrator = async () => {
    setActionPending(true);
    try {
      const response = await fetch("/api/orchestrator/stop", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`stop failed: ${response.status}`);
      }
    } catch (stopError) {
      setError(String(stopError));
    } finally {
      setActionPending(false);
    }
  };

  const runEpicStage = async (stage: "planning" | "retrospective") => {
    if (!storyDependencyGraph.selectedEpicId) {
      return;
    }

    setEpicActionPending(stage);
    try {
      const response = await fetch("/api/orchestrator/run-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage,
          epicId: storyDependencyGraph.selectedEpicId,
          epicNumber: storyDependencyGraph.selectedEpicNumber,
        }),
      });
      if (!response.ok && response.status !== HTTP_CONFLICT) {
        throw new Error(`${stage} run failed: ${response.status}`);
      }
    } catch (stageError) {
      setError(String(stageError));
    } finally {
      setEpicActionPending(null);
    }
  };

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

  const planningLabel =
    storyDependencyGraph.planningState === "not-started" ? "Queue" : "Re-Queue";
  const retrospectiveLabel =
    storyDependencyGraph.retrospectiveState === "not-started"
      ? "Queue"
      : "Re-Queue";

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

      <OrchestratorControlsSection
        actionPending={actionPending}
        epicActionPending={epicActionPending}
        onRunEpicStage={runEpicStage}
        onRunOrchestrator={runOrchestrator}
        onStopOrchestrator={stopOrchestrator}
        orchestratorRunning={data?.orchestrator.isRunning ?? false}
        planningLabel={planningLabel}
        retrospectiveLabel={retrospectiveLabel}
        storyDependencyGraph={storyDependencyGraph}
      />

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
