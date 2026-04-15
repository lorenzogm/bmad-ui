import { createRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { EpicTableSection } from "../app"
import type { OverviewResponse } from "../types"
import { rootRoute } from "./__root"

function EpicsPage() {
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let eventSource: EventSource | null = null

    const applyPayload = (payload: OverviewResponse) => {
      if (!mounted) {
        return
      }
      setData(payload)
      setError(null)
      setLoading(false)
    }

    const load = async () => {
      try {
        const response = await fetch("/api/overview")
        if (!response.ok) {
          throw new Error(`overview request failed: ${response.status}`)
        }
        applyPayload((await response.json()) as OverviewResponse)
      } catch (fetchError) {
        if (mounted) {
          setError(String(fetchError))
          setLoading(false)
        }
      }
    }

    load()

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource("/api/events/overview")
      eventSource.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as OverviewResponse)
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
  }, [])

  if (loading || (error && !data)) {
    return <main className="screen loading">{loading ? "Loading epics..." : error}</main>
  }

  const epics = data?.sprintOverview.epics || []

  return (
    <main className="screen">
      <section className="hero panel reveal">
        <p className="eyebrow">BMAD</p>
        <h1>Epics</h1>
        <p className="subtitle">Epic planning and status overview.</p>
      </section>

      <EpicTableSection
        epicLabels={new Map((data?.dependencyTree.nodes || []).map((n) => [n.id, n.label]))}
        filteredEpics={epics}
      />

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  )
}

export const epicsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/epics",
  component: EpicsPage,
})
