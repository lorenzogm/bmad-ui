import { createRoute } from "@tanstack/react-router"
import type { AnalyticsQuality } from "../types"
import { analyticsLayoutRoute } from "./analytics"
import {
  buildOneShotRateByModelOption,
  buildOneShotRateBySkillOption,
  buildSessionsBySkillStackedOption,
  EChart,
  StatCard,
  useAnalyticsData,
} from "./analytics-utils"

function AnalyticsQualityPage() {
  const { data, loading, error } = useAnalyticsData()

  if (loading) {
    return <main className="screen loading">Loading analytics...</main>
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Failed to load analytics"}</p>
      </main>
    )
  }

  const hasQualityData = data.quality != null && data.quality.overall.sessions > 0

  if (!hasQualityData) {
    return (
      <main className="screen">
        <section className="panel reveal">
          <p className="eyebrow">Analytics</p>
          <h2>Session Quality</h2>
          <p className="subtitle">Run sync-sessions to populate session quality metrics</p>
        </section>
      </main>
    )
  }

  const quality = data.quality as AnalyticsQuality
  const overall = quality.overall

  const deliveryRate =
    overall.sessions > 0 ? Math.round((overall.delivered / overall.sessions) * 100) : 0
  const abortRate =
    overall.sessions > 0 ? Math.round((overall.aborted / overall.sessions) * 100) : 0
  const oneShotRate = Math.round(overall.oneShotRate * 100)

  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>Session Quality</h2>
        <div className="stat-grid">
          <StatCard label="Total Sessions" value={String(overall.sessions)} />
          <StatCard label="Delivery Rate" value={`${deliveryRate}%`} />
          <StatCard label="One-Shot Rate" value={`${oneShotRate}%`} />
          <StatCard label="Abort Rate" value={`${abortRate}%`} />
        </div>
      </section>

      <section className="panel reveal delay-1">
        <h3>One-Shot Rate by Skill</h3>
        <EChart option={buildOneShotRateBySkillOption(quality)} />
      </section>

      <section className="panel reveal delay-2">
        <h3>One-Shot Rate by Model</h3>
        <EChart option={buildOneShotRateByModelOption(quality)} />
      </section>

      <section className="panel reveal delay-3">
        <h3>Sessions by Skill</h3>
        <EChart option={buildSessionsBySkillStackedOption(quality)} />
      </section>
    </main>
  )
}

export const analyticsQualityRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "quality",
  component: AnalyticsQualityPage,
})
