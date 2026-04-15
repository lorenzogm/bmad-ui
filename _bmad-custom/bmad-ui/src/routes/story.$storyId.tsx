import { Link, createRoute, useParams } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { storyStepLabel } from "../app"
import type { StoryDetailResponse } from "../types"
import { rootRoute } from "./__root"

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86_400
const MILLISECONDS_PER_SECOND = 1000

function formatDate(value: string | null): string {
  if (!value) {
    return "-"
  }
  return new Date(value).toLocaleString()
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) {
    return "-"
  }

  const startedMs = Date.parse(startedAt)
  if (Number.isNaN(startedMs)) {
    return "-"
  }

  const endMs = endedAt ? Date.parse(endedAt) : Date.now()
  if (Number.isNaN(endMs)) {
    return "-"
  }

  const totalSeconds = Math.max(0, Math.floor((endMs - startedMs) / MILLISECONDS_PER_SECOND))
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY)
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`)
  }
  parts.push(`${seconds}s`)

  return parts.join(" ")
}

function StoryDetailPage() {
  const { storyId } = useParams({ from: "/story/$storyId" })
  const [data, setData] = useState<StoryDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch(`/api/story/${encodeURIComponent(storyId)}`)
        if (!response.ok) {
          throw new Error(`detail request failed: ${response.status}`)
        }
        const payload = (await response.json()) as StoryDetailResponse
        if (mounted) {
          setData(payload)
          setError(null)
          setLoading(false)
        }
      } catch (detailError) {
        if (mounted) {
          setError(String(detailError))
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [storyId])

  const sessions = useMemo(() => data?.sessions || [], [data])

  if (loading) {
    return <main className="screen loading">Loading story detail...</main>
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Story not found"}</p>
        <Link to="/">Back to dashboard</Link>
      </main>
    )
  }

  return (
    <main className="screen">
      <section className="panel reveal">
        <h2>Story Summary</h2>
        <p className="eyebrow">Story Detail</p>
        <h1>{data.story.id}</h1>
        <p className="subtitle">Current status: {data.story.status}</p>
        <p>
          <Link to="/">Back to dashboard</Link>
        </p>
      </section>

      <section className="panel reveal delay-1">
        <h2>Story Workflow Checklist</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>State</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {data.steps.map((step) => (
                <tr key={step.skill}>
                  <td>{step.label}</td>
                  <td>
                    <span className={`step-badge step-${step.state}`}>{storyStepLabel(step.state)}</span>
                  </td>
                  <td>{step.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel reveal delay-2">
        <h2>Story Sessions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Model</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <Link params={{ sessionId: session.id }} to="/session/$sessionId">
                      {session.skill}
                    </Link>
                  </td>
                  <td>{session.model}</td>
                  <td>{session.status}</td>
                  <td>{formatDate(session.startedAt)}</td>
                  <td>{formatDuration(session.startedAt, session.endedAt)}</td>
                </tr>
              ))}
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5}>No sessions recorded for this story</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel reveal delay-3">
        <h2>Story Artifact</h2>
        <p>{data.story.markdownPath || "No markdown artifact found"}</p>
        <pre className="story-markdown">
          {data.story.markdownContent || "No content available."}
        </pre>
      </section>
    </main>
  )
}

export const storyDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/story/$storyId",
  component: StoryDetailPage,
})
