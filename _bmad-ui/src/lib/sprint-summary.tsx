import { Link } from "@tanstack/react-router"
import { StatusBadge } from "../app"

export type ActiveSprintSummaryProps = {
  epics: Array<{
    id: string
    name: string
    status: string
    storyCount: number
    byStoryStatus: Record<string, number>
  }>
  inProgressStoriesCount: number
  runningSessionsCount: number
}

export function ActiveSprintSummary({
  epics,
  inProgressStoriesCount,
  runningSessionsCount,
}: ActiveSprintSummaryProps) {
  const activeEpic = epics.find((e) => e.status === "in-progress")
  const activeEpicDoneStories = activeEpic?.byStoryStatus?.done ?? 0
  const activeEpicTotalStories = activeEpic?.storyCount ?? 0
  const activeEpicCompletionPercent =
    activeEpicTotalStories > 0
      ? Math.round((activeEpicDoneStories / activeEpicTotalStories) * 100)
      : 0
  const hasActivity =
    activeEpic !== undefined || inProgressStoriesCount > 0 || runningSessionsCount > 0

  if (!hasActivity) {
    return (
      <p className="mt-3" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
        All caught up — no active epics, stories, or sessions running right now.
      </p>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {activeEpic ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="eyebrow" style={{ marginBottom: 0 }}>
            Active Epic
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {activeEpic.name}
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {activeEpicDoneStories}/{activeEpicTotalStories} stories done (
            {activeEpicCompletionPercent}%)
          </span>
          <StatusBadge status="in-progress" />
        </div>
      ) : null}
      <div className="flex gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: "var(--status-progress)",
            }}
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Stories in progress:{" "}
            <strong style={{ color: "var(--text)" }}>{inProgressStoriesCount}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, background: "var(--highlight)" }}
          />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Running sessions:{" "}
            <strong style={{ color: "var(--text)" }}>{runningSessionsCount}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

export type EpicProgressItem = {
  id: string
  name: string
  number: number
  status: string
  storyCount: number
  byStoryStatus: Record<string, number>
}

export function EpicsProgressList(props: { epics: EpicProgressItem[] }) {
  const { epics } = props
  if (epics.length === 0) {
    return (
      <div className="py-8 text-center" style={{ color: "var(--muted)" }}>
        <p>No epics found. Run sprint-planning to initialize.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {[...epics]
        .sort((a, b) => a.number - b.number)
        .map((epic) => {
          const done = epic.byStoryStatus?.done ?? 0
          const total = epic.storyCount
          const pct = total > 0 ? Math.round((done / total) * 100) : 0

          return (
            <Link
              className="flex items-center gap-4 px-4 py-3 rounded-lg"
              key={epic.id}
              params={{ epicId: epic.id }}
              style={{
                background: "rgba(2, 10, 16, 0.66)",
                border: "1px solid rgba(151, 177, 205, 0.12)",
              }}
              to="/epic/$epicId"
            >
              <span
                className="text-sm font-mono font-bold shrink-0 w-8 text-center"
                style={{ color: "var(--highlight)" }}
              >
                {epic.number}
              </span>
              <span className="flex-1 text-sm truncate" style={{ color: "var(--text)" }}>
                {epic.name}
              </span>
              <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                {done}/{total} stories
              </span>
              <div
                className="shrink-0 rounded-full overflow-hidden"
                style={{
                  width: 80,
                  height: 6,
                  background: "rgba(151, 177, 205, 0.15)",
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? "var(--status-done)" : "var(--highlight)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <StatusBadge status={epic.status} />
            </Link>
          )
        })}
    </div>
  )
}
