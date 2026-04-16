import { createRoute, Link, useParams } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { storyStepLabel } from "../app"
import { apiUrl, IS_LOCAL_MODE, PROD_DISABLED_TITLE } from "../lib/mode"
import type {
  EpicDetailResponse,
  OverviewResponse,
  RuntimeSession,
  StoryStatus,
  WorkflowStepState,
} from "../types"
import { rootRoute } from "./__root"

const HTTP_CONFLICT = 409
const EPIC_NUMBER_REGEX = /^epic-(\d+)$/
const PERCENT_MULTIPLIER = 100
const ORCHESTRATING_STORAGE_PREFIX = "bmad-orchestrating:"

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

const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  backlog: "To Do",
  "ready-for-dev": "In Progress",
  "in-progress": "In Progress",
  review: "In Progress",
  done: "Done",
}

function storyStatusLabel(status: StoryStatus): string {
  return STORY_STATUS_LABELS[status] ?? status
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

function findLatestSession(
  runtimeSessions: RuntimeSession[],
  storyId: string,
  skill: string
): RuntimeSession | null {
  const matching = runtimeSessions
    .filter((s) => s.storyId === storyId && s.skill === skill && s.status !== "planned")
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  return matching[0] ?? null
}

function SessionLink(props: { session: RuntimeSession | null }) {
  const { session } = props
  if (!session) {
    return null
  }

  const hasLog = session.logPath && session.logPath.length > 0
  const isFailed = session.status === "failed" || session.status === "cancelled"
  const isRunning = session.status === "running"

  if (!hasLog) {
    return (
      <span className="session-link-icon session-link-disabled" title="No log available">
        ⊘
      </span>
    )
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
  )
}

function EpicDetailPage() {
  const { epicId } = useParams({ from: "/epic/$epicId" })
  const [data, setData] = useState<EpicDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)
  const [overviewData, setOverviewData] = useState<OverviewResponse | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const orchestratingKey = `${ORCHESTRATING_STORAGE_PREFIX}${epicId}`
  const [isOrchestrating, setIsOrchestrating] = useState(() => {
    try {
      return localStorage.getItem(orchestratingKey) === "true"
    } catch {
      return false
    }
  })
  const [bulkError, setBulkError] = useState<string | null>(null)
  const initiatedRef = useRef(new Set<string>())

  const handleRunSkill = useCallback(async (skill: WorkflowSkill, storyId?: string) => {
    if (!IS_LOCAL_MODE) {
      return
    }
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
          fetch(apiUrl(`/api/epic/${encodeURIComponent(epicId)}`)),
          fetch(apiUrl("/api/overview")),
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

    if (IS_LOCAL_MODE && typeof EventSource !== "undefined") {
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

  const retrospectiveState = useMemo<WorkflowStepState>(() => {
    if (!overviewData || !epicNumber) {
      return "not-started"
    }

    const epic = overviewData.sprintOverview.epics.find(
      (candidate) => candidate.number === Number(epicNumber)
    )

    return epic?.lifecycleSteps["bmad-retrospective"] ?? "not-started"
  }, [overviewData, epicNumber])

  const latestRetroSession = useMemo(() => {
    const runtimeSessions = overviewData?.runtimeState?.sessions ?? []
    const matching = runtimeSessions
      .filter((s) => s.skill === "bmad-retrospective" && s.status !== "planned")
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    return matching[0] ?? null
  }, [overviewData])

  const allStoriesDone = useMemo(
    () => stories.length > 0 && stories.every((story) => story.status === "done"),
    [stories]
  )

  const storiesNeedingPlan = useMemo(() => {
    const fromPlanned = data?.plannedStories ?? []
    const fromExisting = stories
      .filter((s) => s.steps["bmad-create-story"] === "not-started")
      .map((s) => s.id)
      .filter((id) => !fromPlanned.includes(id))
    return [...fromPlanned, ...fromExisting]
  }, [data?.plannedStories, stories])

  const showDevelopAllButton = useMemo(
    () => stories.some((s) => s.steps["bmad-create-story"] === "completed" && s.status !== "done"),
    [stories]
  )

  const handlePlanAllStories = useCallback(async () => {
    if (!IS_LOCAL_MODE || !data) return
    setIsPlanning(true)
    setBulkError(null)

    const storiesToPlan = [
      ...(data.plannedStories ?? []),
      ...stories
        .filter((s) => s.steps["bmad-create-story"] === "not-started")
        .map((s) => s.id)
        .filter((id) => !(data.plannedStories ?? []).includes(id)),
    ]

    if (storiesToPlan.length === 0) {
      setIsPlanning(false)
      return
    }

    const results = await Promise.allSettled(
      storiesToPlan.map((storyId) =>
        fetch("/api/workflow/run-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: "bmad-create-story", storyId }),
        })
      )
    )

    const errors: string[] = []
    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason))
      } else if (!result.value.ok && result.value.status !== HTTP_CONFLICT) {
        errors.push(`request failed: ${result.value.status}`)
      }
    }

    if (errors.length > 0) {
      setBulkError(`Some story creations failed: ${errors.join("; ")}`)
    }

    setIsPlanning(false)
  }, [data, stories])

  const handleDevelopAllStories = useCallback(() => {
    if (!IS_LOCAL_MODE) return
    initiatedRef.current.clear()
    setIsOrchestrating(true)
    try {
      localStorage.setItem(orchestratingKey, "true")
    } catch {
      /* storage unavailable */
    }
    setBulkError(null)
  }, [orchestratingKey])

  const handleStopOrchestration = useCallback(() => {
    setIsOrchestrating(false)
    try {
      localStorage.removeItem(orchestratingKey)
    } catch {
      /* storage unavailable */
    }
  }, [orchestratingKey])

  // Orchestration driver: fires dev-story → code-review → retrospective as stories progress
  useEffect(() => {
    if (!isOrchestrating || !data) return

    const runtimeSessions = overviewData?.runtimeState?.sessions ?? []
    const deps = data.storyDependencies ?? {}
    const currentStoryStatusMap = new Map<string, string>()
    for (const s of stories) {
      currentStoryStatusMap.set(s.id, s.status)
    }

    for (const story of stories) {
      const createState = story.steps["bmad-create-story"] ?? "not-started"
      const rawDevState = story.steps["bmad-dev-story"] ?? "not-started"
      const isDevAgentRunning = runtimeSessions.some(
        (s) => s.storyId === story.id && s.skill === "bmad-dev-story"
      )
      const devState = rawDevState === "running" && !isDevAgentRunning ? "not-started" : rawDevState
      const rawReviewState = story.steps["bmad-code-review"] ?? "not-started"
      const isReviewAgentRunning = runtimeSessions.some(
        (s) => s.storyId === story.id && s.skill === "bmad-code-review"
      )
      const reviewState =
        rawReviewState === "running" && !isReviewAgentRunning ? "not-started" : rawReviewState
      const blockers = getBlockingStories(story.id, deps, currentStoryStatusMap)
      const isBlocked = blockers.length > 0

      if (createState === "completed" && devState === "not-started" && !isBlocked) {
        const key = `bmad-dev-story:${story.id}`
        if (!initiatedRef.current.has(key)) {
          initiatedRef.current.add(key)
          fetch("/api/workflow/run-skill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skill: "bmad-dev-story", storyId: story.id }),
          })
            .then((r) => {
              if (r.status === HTTP_CONFLICT) {
                initiatedRef.current.delete(key)
              } else if (!r.ok) {
                setBulkError(`Failed to start dev for ${story.id}: ${r.status}`)
              }
            })
            .catch((err) => {
              initiatedRef.current.delete(key)
              setBulkError(`Failed to start dev for ${story.id}: ${String(err)}`)
            })
        }
      }

      if (devState === "completed" && reviewState === "not-started") {
        const key = `bmad-code-review:${story.id}`
        if (!initiatedRef.current.has(key)) {
          initiatedRef.current.add(key)
          fetch("/api/workflow/run-skill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skill: "bmad-code-review",
              storyId: story.id,
              autoResolve: true,
            }),
          })
            .then((r) => {
              if (r.status === HTTP_CONFLICT) {
                initiatedRef.current.delete(key)
              } else if (!r.ok) {
                setBulkError(`Failed to start review for ${story.id}: ${r.status}`)
              }
            })
            .catch((err) => {
              initiatedRef.current.delete(key)
              setBulkError(`Failed to start review for ${story.id}: ${String(err)}`)
            })
        }
      }
    }

    if (allStoriesDone && retrospectiveState === "not-started") {
      const key = "bmad-retrospective"
      if (!initiatedRef.current.has(key)) {
        initiatedRef.current.add(key)
        fetch("/api/workflow/run-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: "bmad-retrospective", autoResolve: true }),
        })
          .then((r) => {
            if (!r.ok) {
              initiatedRef.current.delete(key)
              setBulkError(`Failed to start retrospective: ${r.status}`)
            }
          })
          .catch((err) => {
            initiatedRef.current.delete(key)
            setBulkError(`Failed to start retrospective: ${String(err)}`)
          })
      }
    }

    if (retrospectiveState === "completed") {
      setIsOrchestrating(false)
      try {
        localStorage.removeItem(orchestratingKey)
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
    overviewData,
  ])

  const doneCount = stories.filter((s) => s.status === "done").length
  const inProgressCount = stories.filter(
    (s) => s.status === "in-progress" || s.status === "review" || s.status === "ready-for-dev"
  ).length
  const progressPercent =
    stories.length > 0 ? Math.round((doneCount / stories.length) * PERCENT_MULTIPLIER) : 0

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
      <section className="panel reveal epic-header">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/">
            ← Home
          </Link>
          <span className={`step-badge step-${data.epic.status}`}>{data.epic.status}</span>
        </div>
        <p className="eyebrow">Epic {data.epic.number}</p>
        <h1 className="epic-title">{data.epic.name || data.epic.id}</h1>
        {data.epic.description ? <p className="epic-description">{data.epic.description}</p> : null}
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
            <span className="epic-stat-value epic-stat-progress">{inProgressCount}</span>
            <span className="epic-stat-label">In Progress</span>
          </div>
          <div className="epic-stat">
            <span className="epic-stat-value">{progressPercent}%</span>
            <span className="epic-stat-label">Complete</span>
          </div>
        </div>
        {stories.length > 0 ? (
          <div className="epic-progress-bar">
            <div className="epic-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        ) : null}
        {storiesNeedingPlan.length > 0 || showDevelopAllButton ? (
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginTop: "1.25rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
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
                {isOrchestrating ? "Developing all stories…" : "Develop all stories"}
              </button>
            ) : null}
            {isOrchestrating ? (
              <>
                <button className="ghost" onClick={handleStopOrchestration} type="button">
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
                <th>Dev Story</th>
                <th>Code Review</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStories.map((story) => {
                const runtimeSessions = overviewData?.runtimeState?.sessions ?? []
                const createState = story.steps["bmad-create-story"] ?? "not-started"
                const rawDevState = story.steps["bmad-dev-story"] ?? "not-started"
                const isDevAgentRunning = runtimeSessions.some(
                  (s) => s.storyId === story.id && s.skill === "bmad-dev-story"
                )
                const devState =
                  rawDevState === "running" && !isDevAgentRunning ? "not-started" : rawDevState
                const rawReviewState = story.steps["bmad-code-review"] ?? "not-started"
                const isReviewAgentRunning = runtimeSessions.some(
                  (s) => s.storyId === story.id && s.skill === "bmad-code-review"
                )
                const reviewState =
                  rawReviewState === "running" && !isReviewAgentRunning
                    ? "not-started"
                    : rawReviewState

                const latestCreateSession = findLatestSession(
                  runtimeSessions,
                  story.id,
                  "bmad-create-story"
                )
                const latestDevSession = findLatestSession(
                  runtimeSessions,
                  story.id,
                  "bmad-dev-story"
                )
                const latestReviewSession = findLatestSession(
                  runtimeSessions,
                  story.id,
                  "bmad-code-review"
                )

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
                        <span className={`step-badge step-${createState}`}>
                          {storyStepLabel(createState)}
                        </span>
                        <SessionLink session={latestCreateSession} />
                        {nextSkill === "bmad-create-story" && (
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
                      </div>
                    </td>
                    <td>
                      <div className="step-cell">
                        <span className={`step-badge step-${devState}`}>
                          {storyStepLabel(devState)}
                        </span>
                        <SessionLink session={latestDevSession} />
                        {nextSkill === "bmad-dev-story" && !isBlocked && (
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
                        <span className={`step-badge step-${reviewState}`}>
                          {storyStepLabel(reviewState)}
                        </span>
                        <SessionLink session={latestReviewSession} />
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
                    <td>
                      <span className={`step-badge step-${story.status}`}>
                        {storyStatusLabel(story.status as StoryStatus)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filteredStories.length === 0 ? (
                <tr>
                  <td colSpan={5}>No stories found for this epic</td>
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
            <span className={`step-badge step-${retrospectiveState}`}>
              {storyStepLabel(retrospectiveState)}
            </span>
            <SessionLink session={latestRetroSession} />
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

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  )
}

export const epicDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/epic/$epicId",
  component: EpicDetailPage,
})
