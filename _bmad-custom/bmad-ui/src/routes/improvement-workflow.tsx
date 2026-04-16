import { createRoute, Link, useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { IMPROVEMENT_STEPS, storyStepLabel } from "../app"
import type { WorkflowStepState } from "../types"
import { rootRoute } from "./__root"

const HTTP_CONFLICT = 409

type ImprovementStepStatus = {
  skill: string
  state: WorkflowStepState
  sessionId: string | null
}

function ImprovementWorkflowPage() {
  const navigate = useNavigate()
  const [stepStatuses, setStepStatuses] = useState<ImprovementStepStatus[]>(
    IMPROVEMENT_STEPS.map((s) => ({ skill: s.skill, state: "not-started", sessionId: null }))
  )
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunSkill = useCallback(async (skill: string) => {
    setPendingSkill(skill)
    setError(null)

    try {
      const response = await fetch("/api/workflow/run-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill }),
      })

      if (response.status === HTTP_CONFLICT) {
        throw new Error(
          "Another workflow is already running. Wait for it to finish before starting a new one."
        )
      }

      if (!response.ok) {
        throw new Error(`workflow request failed: ${response.status}`)
      }

      const result = await response.json() as { sessionId: string }

      setStepStatuses((prev) =>
        prev.map((s) => (s.skill === skill ? { ...s, state: "running", sessionId: result.sessionId } : s))
      )

      void navigate({ to: "/session/$sessionId", params: { sessionId: result.sessionId } })
    } catch (runError) {
      setPendingSkill(null)
      setError(String(runError))
    }
  }, [navigate])

  const handleMarkDone = useCallback((skill: string) => {
    setStepStatuses((prev) =>
      prev.map((s) => (s.skill === skill ? { ...s, state: "completed" } : s))
    )
    setPendingSkill((prev) => (prev === skill ? null : prev))
  }, [])

  const handleReset = useCallback((skill: string) => {
    setStepStatuses((prev) =>
      prev.map((s) => (s.skill === skill ? { ...s, state: "not-started" } : s))
    )
    setPendingSkill((prev) => (prev === skill ? null : prev))
  }, [])

  const doneCount = stepStatuses.filter((s) => s.state === "completed").length
  const totalSteps = IMPROVEMENT_STEPS.length

  const nextStepIndex = stepStatuses.findIndex((s) => s.state === "not-started")

  return (
    <main className="screen">
      <section className="panel reveal epic-header">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/">
            ← Home
          </Link>
        </div>
        <p className="eyebrow">Workflow</p>
        <h1 className="epic-title">Improvement Workflow</h1>
        <p className="epic-description">
          Bring your documentation back in sync with reality and plan the next round of
          improvements. Work through each step in order — each produces artifacts that feed the
          next.
        </p>
        <div className="epic-stats">
          <div className="epic-stat">
            <span className="epic-stat-value">{totalSteps}</span>
            <span className="epic-stat-label">Steps</span>
          </div>
          <div className="epic-stat">
            <span className="epic-stat-value epic-stat-done">{doneCount}</span>
            <span className="epic-stat-label">Done</span>
          </div>
          <div className="epic-stat">
            <span className="epic-stat-value">
              {Math.round((doneCount / totalSteps) * 100)}%
            </span>
            <span className="epic-stat-label">Complete</span>
          </div>
        </div>
        <div className="epic-progress-bar">
          <div
            className="epic-progress-fill"
            style={{ width: `${Math.round((doneCount / totalSteps) * 100)}%` }}
          />
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="panel reveal delay-1">
        <h2>Steps</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>Skill</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {IMPROVEMENT_STEPS.map((step, index) => {
                const status = stepStatuses[index]
                const isNext = index === nextStepIndex
                const isRunning = status.state === "running"
                const isDone = status.state === "completed"

                return (
                  <tr key={step.skill} className={isNext ? "improvement-row-next" : ""}>
                    <td>
                      <span
                        className={`improvement-step-number${isDone ? " improvement-step-number-done" : ""}`}
                      >
                        {isDone ? "✓" : step.number}
                      </span>
                    </td>
                    <td>
                      <div className="improvement-cell-name">
                        <strong>{step.name}</strong>
                        <span className="improvement-cell-desc">{step.description}</span>
                      </div>
                    </td>
                    <td>
                      <code className="improvement-step-skill">{step.skill}</code>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className={`step-badge step-${isRunning ? "running" : status.state === "completed" ? "done" : "not-started"}`}
                      >
                        {isRunning ? (
                          <>
                            <span aria-hidden="true" className="agent-icon">
                              ⬡
                            </span>
                            {" running"}
                          </>
                        ) : (
                          storyStepLabel(status.state)
                        )}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div className="improvement-actions">
                        {!isDone && !isRunning && (
                          <button
                            className="icon-button icon-button-play"
                            disabled={pendingSkill !== null}
                            onClick={() => void handleRunSkill(step.skill)}
                            title={`Run ${step.skill}`}
                            type="button"
                          >
                            <span aria-hidden="true" className="icon-glyph">
                              ▶
                            </span>
                          </button>
                        )}
                        {(isRunning || isDone) && (
                          <button
                            className="ghost"
                            onClick={() =>
                              isDone ? handleReset(step.skill) : handleMarkDone(step.skill)
                            }
                            title={isDone ? "Reset to not started" : "Mark as done"}
                            type="button"
                          >
                            {isDone ? "↺" : "✓ Done"}
                          </button>
                        )}
                        {status.sessionId ? (
                          <Link
                            className={`session-link-icon${isRunning ? " session-link-running" : ""}`}
                            params={{ sessionId: status.sessionId }}
                            title={`View session: ${status.sessionId}`}
                            to="/session/$sessionId"
                          >
                            ◉
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export const improvementWorkflowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/improvement-workflow",
  component: ImprovementWorkflowPage,
})
