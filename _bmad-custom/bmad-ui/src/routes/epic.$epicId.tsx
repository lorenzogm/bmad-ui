import { Link, createRoute, useParams } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AgentSessionsSection } from "../app"
import type { SessionActionState } from "../app"
import type {
  AgentRunGroup,
  AgentSession,
  EpicDetailResponse,
  OverviewResponse,
  WorkflowStepState,
} from "../types"
import { rootRoute } from "./__root"

const HTTP_CONFLICT = 409
const EPIC_NUMBER_REGEX = /^epic-(\d+)$/

type SkillName = "bmad-create-story" | "bmad-dev-story" | "bmad-code-review"
type WorkflowSkill = SkillName | "bmad-retrospective"

function shouldClearPendingSkill(
  pendingSkill: string | null,
  stories: EpicDetailResponse["stories"]
): boolean {
  if (!pendingSkill) {
    return false
  }

  const separatorIndex = pendingSkill.indexOf(":")
  if (separatorIndex === -1) {
    return true
  }

  const skill = pendingSkill.slice(0, separatorIndex) as SkillName
  const storyId = pendingSkill.slice(separatorIndex + 1)
  const story = stories.find((candidate) => candidate.id === storyId)

  if (!story) {
    return false
  }

  return story.steps[skill] !== "not-started"
}

function getBlockingStories(
  storyId: string,
  storyDependencies: Record<string, string[]>,
  storyStatusMap: Map<string, string>
): string[] {
  const deps = storyDependencies[storyId]
  if (!deps || deps.length === 0) {
    return []
  }
  return deps.filter((depId) => {
    const status = storyStatusMap.get(depId)
    return status !== "done"
  })
}

const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/

function parseStoryTicket(storyId: string): { epic: number; story: number } {
  const match = storyId.match(STORY_TICKET_REGEX)
  if (!match) {
    return { epic: Number.POSITIVE_INFINITY, story: Number.POSITIVE_INFINITY }
  }
  return {
    epic: Number(match[1]),
    story: Number(match[2]),
  }
}

function EpicDetailPage() {
  const { epicId } = useParams({ from: "/epic/$epicId" })
  const [data, setData] = useState<EpicDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null)
  const [sessionActionPending, setSessionActionPending] = useState<SessionActionState>(null)

  const handleRunSkill = useCallback(async (skill: WorkflowSkill, storyId?: string) => {
    setPendingSkill(storyId ? `${skill}:${storyId}` : skill)
    setError(null)

    try {
      const response = await fetch("/api/workflow/run-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, storyId }),
      })

      if (response.status === HTTP_CONFLICT) {
        throw new Error(
          "Another workflow is already running. Wait for it to finish before starting a new one."
        )
      }

      if (!response.ok) {
        throw new Error(`workflow request failed: ${response.status}`)
      }

      setData((prev) => {
        if (!prev || !storyId || skill === "bmad-retrospective") {
          return prev
        }

        return {
          ...prev,
          stories: prev.stories.map((story) =>
            story.id === storyId
              ? {
                  ...story,
                  steps: {
                    ...story.steps,
                    [skill]: "running",
                  },
                }
              : story
          ),
        }
      })
    } catch (runSkillError) {
      setPendingSkill(null)
      setError(String(runSkillError))
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let eventSource: EventSource | null = null

    const load = async () => {
      try {
        const [epicResponse, overviewResponse] = await Promise.all([
          fetch(`/api/epic/${encodeURIComponent(epicId)}`),
          fetch("/api/overview"),
        ])
        if (!epicResponse.ok) {
          throw new Error(`epic detail request failed: ${epicResponse.status}`)
        }
        const [epicPayload, overviewPayload] = await Promise.all([
          epicResponse.json() as Promise<EpicDetailResponse>,
          overviewResponse.ok
            ? (overviewResponse.json() as Promise<OverviewResponse>)
            : Promise.resolve(null),
        ])
        if (mounted) {
          setData({
            ...epicPayload,
            storyDependencies: overviewPayload?.storyDependencies ?? epicPayload.storyDependencies,
          })
          if (overviewPayload) {
            setOverviewData(overviewPayload)
          }
          setError(null)
          setLoading(false)
        }
      } catch (epicError) {
        if (mounted) {
          setError(String(epicError))
          setLoading(false)
        }
      }
    }

    load()

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource("/api/events/overview")
      eventSource.onmessage = (event) => {
        if (!mounted) return
        try {
          const overview = JSON.parse(event.data) as OverviewResponse
          setOverviewData(overview)
          const storyUpdates = new Map(overview.sprintOverview.stories.map((s) => [s.id, s]))

          setPendingSkill((prevPendingSkill) =>
            shouldClearPendingSkill(prevPendingSkill, overview.sprintOverview.stories)
              ? null
              : prevPendingSkill
          )

          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              stories: prev.stories.map((story) => {
                const update = storyUpdates.get(story.id)
                return update ? { ...story, status: update.status, steps: update.steps } : story
              }),
              storyDependencies: overview.storyDependencies ?? prev.storyDependencies,
            }
          })
        } catch (parseError) {
          if (mounted) {
            setError(String(parseError))
          }
        }
      }
    }

    return () => {
      mounted = false
      eventSource?.close()
    }
  }, [epicId])

  const stories = useMemo(
    () =>
      [...(data?.stories || [])].sort((a, b) => {
        const aTicket = parseStoryTicket(a.id)
        const bTicket = parseStoryTicket(b.id)

        if (aTicket.epic !== bTicket.epic) {
          return aTicket.epic - bTicket.epic
        }

        if (aTicket.story !== bTicket.story) {
          return aTicket.story - bTicket.story
        }

        return a.id.localeCompare(b.id)
      }),
    [data]
  )

  const storyStatusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const story of stories) {
      map.set(story.id, story.status)
    }
    return map
  }, [stories])

  const filteredStories = useMemo(() => {
    return stories
  }, [stories])

  const epicNumber = epicId.match(EPIC_NUMBER_REGEX)?.[1] ?? null
  const storyPrefix = epicNumber ? `${epicNumber}-` : null

  const retrospectiveState = useMemo<WorkflowStepState>(() => {
    if (!overviewData || !epicNumber) {
      return "not-started"
    }

    const epic = overviewData.sprintOverview.epics.find(
      (candidate) => candidate.number === Number(epicNumber)
    )

    return epic?.lifecycleSteps["bmad-retrospective"] ?? "not-started"
  }, [overviewData, epicNumber])

  const allStoriesDone = useMemo(
    () => stories.length > 0 && stories.every((story) => story.status === "done"),
    [stories]
  )

  const epicRunGroups = useMemo<AgentRunGroup[]>(() => {
    if (!storyPrefix || !overviewData) {
      return []
    }

    const history = overviewData.agentRunHistory ?? []
    const currentSessions = overviewData.runtimeState?.sessions ?? []

    const filterByEpic = (sessions: typeof currentSessions): typeof currentSessions =>
      sessions.filter((s) => s.storyId?.startsWith(storyPrefix))

    const currentFiltered = filterByEpic(currentSessions)
    const currentGroup: AgentRunGroup | null =
      currentFiltered.length > 0
        ? {
            id: "run-current",
            startedAt: overviewData.runtimeState?.startedAt ?? new Date().toISOString(),
            endedAt:
              overviewData.runtimeState?.status === "running"
                ? null
                : (currentFiltered
                    .map((s) => s.endedAt)
                    .filter((t): t is string => t !== null)
                    .sort()
                    .at(-1) ?? null),
            sessions: [...currentFiltered].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
          }
        : null

    const historyGroups = history
      .map((g) => ({
        ...g,
        sessions: filterByEpic(g.sessions).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
      }))
      .filter((g) => g.sessions.length > 0)

    return currentGroup ? [currentGroup, ...historyGroups] : historyGroups
  }, [overviewData, storyPrefix])

  const epicAgentSessions = useMemo<AgentSession[]>(() => {
    if (!storyPrefix || !overviewData) {
      return []
    }
    return (overviewData.agentSessions ?? []).filter((s) => s.storyId?.startsWith(storyPrefix))
  }, [overviewData, storyPrefix])

  const startSession = useCallback(async (sessionId: string) => {
    setSessionActionPending({ sessionId, action: "start" })
    try {
      const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}/start`, {
        method: "POST",
      })
      if (!response.ok && response.status !== HTTP_CONFLICT) {
        throw new Error(`start failed: ${response.status}`)
      }
    } catch (sessionStartError) {
      setError(String(sessionStartError))
    } finally {
      setSessionActionPending(null)
    }
  }, [])

  const abortSession = useCallback(async (sessionId: string) => {
    setSessionActionPending({ sessionId, action: "abort" })
    try {
      const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}/abort`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(`abort failed: ${response.status}`)
      }
    } catch (sessionAbortError) {
      setError(String(sessionAbortError))
    } finally {
      setSessionActionPending(null)
    }
  }, [])

  if (loading) {
    return <main className="screen loading">Loading epic detail...</main>
  }

  if (!data) {
    return (
      <main className="screen loading">
        <p>{error || "Epic not found"}</p>
        <Link to="/">Back to home</Link>
      </main>
    )
  }

  return (
    <main className="screen">
      <section className="panel reveal">
        <h2>Epic Summary</h2>
        <p className="eyebrow">Epic Detail</p>
        <h1>{data.epic.id}</h1>
        <p className="subtitle">Current status: {data.epic.status}</p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>

      <section className="panel reveal delay-1">
        <h2>Stories In This Epic</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Story</th>
                <th>Create Story</th>
                <th>Dev Story</th>
                <th>Code Review</th>
              </tr>
            </thead>
            <tbody>
              {filteredStories.map((story) => {
                const createState = story.steps["bmad-create-story"] ?? "not-started"
                const devState = story.steps["bmad-dev-story"] ?? "not-started"
                const reviewState = story.steps["bmad-code-review"] ?? "not-started"

                const SKILL_ORDER: { skill: SkillName; state: string }[] = [
                  { skill: "bmad-create-story", state: createState },
                  { skill: "bmad-dev-story", state: devState },
                  { skill: "bmad-code-review", state: reviewState },
                ]
                const nextSkillIndex = SKILL_ORDER.findIndex((s) => s.state === "not-started")
                const allPriorCompleted =
                  nextSkillIndex >= 0 &&
                  SKILL_ORDER.slice(0, nextSkillIndex).every((s) => s.state === "completed")
                const nextSkill =
                  nextSkillIndex >= 0 && allPriorCompleted
                    ? SKILL_ORDER[nextSkillIndex].skill
                    : null

                const blockers = getBlockingStories(
                  story.id,
                  data.storyDependencies ?? {},
                  storyStatusMap
                )
                const isBlocked = blockers.length > 0
                const blockedTooltip = `Blocked by ${blockers.join(", ")}`

                return (
                  <tr key={story.id}>
                    <td>
                      <Link params={{ storyId: story.id }} to="/story/$storyId">
                        {story.id}
                      </Link>
                    </td>
                    <td>
                      <div className="step-cell">
                        <span className={`step-badge step-${createState}`}>{createState}</span>
                        {nextSkill === "bmad-create-story" && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkill !== null}
                            onClick={() => void handleRunSkill("bmad-create-story", story.id)}
                            title={`Run bmad-create-story for ${story.id}`}
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
                      <div className="step-cell">
                        <span className={`step-badge step-${devState}`}>{devState}</span>
                        {nextSkill === "bmad-dev-story" && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkill !== null || isBlocked}
                            onClick={() => void handleRunSkill("bmad-dev-story", story.id)}
                            title={
                              isBlocked ? blockedTooltip : `Run bmad-dev-story for ${story.id}`
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
                      <div className="step-cell">
                        <span className={`step-badge step-${reviewState}`}>{reviewState}</span>
                        {nextSkill === "bmad-code-review" && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkill !== null || isBlocked}
                            onClick={() => void handleRunSkill("bmad-code-review", story.id)}
                            title={
                              isBlocked ? blockedTooltip : `Run bmad-code-review for ${story.id}`
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
                  </tr>
                )
              })}
              {filteredStories.length === 0 ? (
                <tr>
                  <td colSpan={4}>No stories found for this epic</td>
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
            <span className={`step-badge step-${retrospectiveState}`}>{retrospectiveState}</span>
            {retrospectiveState === "not-started" && allStoriesDone ? (
              <button
                className="icon-button icon-button-play"
                disabled={pendingSkill !== null}
                onClick={() => void handleRunSkill("bmad-retrospective")}
                title={`Run bmad-retrospective for epic-${epicNumber}`}
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

      <AgentSessionsSection
        agentSessions={epicAgentSessions}
        onAbortSession={abortSession}
        onStartSession={startSession}
        runGroups={epicRunGroups}
        sessionActionPending={sessionActionPending}
      />

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  )
}

export const epicDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/epic/$epicId",
  component: EpicDetailPage,
})
