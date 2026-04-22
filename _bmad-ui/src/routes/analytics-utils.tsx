import * as echarts from "echarts"
import { useCallback, useEffect, useRef, useState } from "react"
import { apiUrl } from "../lib/mode"
import type {
  AnalyticsCosting,
  AnalyticsQuality,
  AnalyticsResponse,
  EpicAnalytics,
  SessionAnalytics,
  TokenUsage,
} from "../types"

// ── Chart theme constants ──────────────────────────────────────────
const CHART_TEXT_COLOR = "#e6edf4"
const CHART_MUTED_COLOR = "#a6b9c8"
const CHART_BORDER_COLOR = "rgba(151, 177, 205, 0.22)"
const CHART_BG_TRANSPARENT = "transparent"

// Palette derived from the two primary accent colors:
// teal (#2ec4b6) and green (#22c55e), spanning hue variants
// from green → teal → cyan → blue with consistent saturation/lightness.
const CHART_COLOR_01 = "#22c55e" // green (--status-progress)
const CHART_COLOR_02 = "#2ec4b6" // teal  (--highlight)
const CHART_COLOR_03 = "#34d399" // emerald — midpoint green↔teal
const CHART_COLOR_04 = "#06b6d4" // cyan
const CHART_COLOR_05 = "#0ea5e9" // sky blue
const CHART_COLOR_06 = "#38bdf8" // light sky
const CHART_COLOR_07 = "#2dd4bf" // teal-light
const CHART_COLOR_08 = "#4ade80" // green-light
const CHART_COLOR_09 = "#14b8a6" // teal-deep
const CHART_COLOR_10 = "#10b981" // emerald-deep
const CHART_COLOR_11 = "#67e8f9" // cyan-light
const CHART_COLOR_12 = "#a7f3d0" // mint

const CHART_PALETTE = [
  CHART_COLOR_01,
  CHART_COLOR_02,
  CHART_COLOR_03,
  CHART_COLOR_04,
  CHART_COLOR_05,
  CHART_COLOR_06,
  CHART_COLOR_07,
  CHART_COLOR_08,
  CHART_COLOR_09,
  CHART_COLOR_10,
  CHART_COLOR_11,
  CHART_COLOR_12,
]

export function formatNumber(value: number, maxDecimals = 1): string {
  if (value >= 1_000_000) {
    return `${Number.parseFloat((value / 1_000_000).toFixed(maxDecimals))}M`
  }
  if (value >= 1000) {
    return `${Number.parseFloat((value / 1000).toFixed(maxDecimals))}K`
  }
  return String(Number.parseFloat(value.toFixed(maxDecimals)))
}

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "$0.00"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function AnalyticsCostBanner({ costing }: { costing: AnalyticsCosting }) {
  const seat = costing.estimatedCostUsd.seatCostPerUserPerMonth
  const overage = costing.estimatedCostUsd.fromPremiumRequests
  const plan = costing.subscription?.plan || "copilot"

  return (
    <div className="analytics-cost-banner">
      <span>
        Plan: <strong>{plan}</strong>
      </span>
      <span>
        Seat/User/Month: <strong>{formatUsd(seat)}</strong>
      </span>
      <span>
        Premium Requests: <strong>{formatNumber(costing.totals.premiumRequests, 2)}</strong>
      </span>
      <span>
        Overage Estimate: <strong>{formatUsd(overage)}</strong>
      </span>
    </div>
  )
}

export function UsageBar({ usage, maxTotal }: { usage: TokenUsage; maxTotal: number }) {
  const pct = maxTotal > 0 ? Math.max(2, (usage.totalTokens / maxTotal) * 100) : 0
  return (
    <div className="usage-bar-wrap">
      <div className="usage-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function UsageCell({ usage }: { usage: TokenUsage }) {
  return (
    <span className="usage-cell">
      <span className="usage-in" title="Tokens In">
        ↑{formatNumber(usage.tokensIn)}
      </span>
      <span className="usage-sep">·</span>
      <span className="usage-out" title="Tokens Out">
        ↓{formatNumber(usage.tokensOut)}
      </span>
      <span className="usage-sep">·</span>
      <span className="usage-cached" title="Cached">
        ⚡{formatNumber(usage.tokensCached)}
      </span>
    </span>
  )
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  )
}

export function useAnalyticsData() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch(apiUrl("/api/analytics"))
        if (!response.ok) {
          throw new Error(`analytics request failed: ${response.status}`)
        }
        const payload = (await response.json()) as AnalyticsResponse
        if (mounted) {
          setData(payload)
          setError(null)
          setLoading(false)
        }
      } catch (fetchError) {
        if (mounted) {
          setError(String(fetchError))
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  return { data, loading, error }
}

// ── EChart component ───────────────────────────────────────────────

export function EChart({ option }: { option: echarts.EChartsOption }) {
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup previous instance
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose()
        chartInstanceRef.current = null
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      const instance = echarts.init(node)
      instance.setOption(option)
      chartInstanceRef.current = instance

      const ro = new ResizeObserver(() => {
        instance.resize()
      })
      ro.observe(node)
      observerRef.current = ro
    },
    [option]
  )

  return <div ref={containerRef} className="chart-container" />
}

// ── Chart option builders ──────────────────────────────────────────

function buildBaseChartOption(): echarts.EChartsOption {
  return {
    backgroundColor: CHART_BG_TRANSPARENT,
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: "Space Grotesk, sans-serif" },
    legend: { textStyle: { color: CHART_MUTED_COLOR } },
    tooltip: {
      backgroundColor: "rgba(10, 19, 29, 0.94)",
      borderColor: CHART_BORDER_COLOR,
      textStyle: { color: CHART_TEXT_COLOR },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
  }
}

export function buildRequestsOverTimeOption(sessions: SessionAnalytics[]): echarts.EChartsOption {
  const dayMap = new Map<string, number>()

  for (const s of sessions) {
    if (!s.startedAt) continue
    const day = s.startedAt.slice(0, 10) // YYYY-MM-DD
    dayMap.set(day, (dayMap.get(day) ?? 0) + s.usage.requests)
  }

  const sorted = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dates = sorted.map(([d]) => d)
  const requests = sorted.map(([, v]) => v)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
    },
    yAxis: {
      type: "value",
      name: "Requests",
      nameTextStyle: { color: CHART_MUTED_COLOR },
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    series: [
      {
        name: "Requests",
        type: "line",
        smooth: true,
        data: requests,
        itemStyle: { color: CHART_COLOR_02 },
        areaStyle: { color: "rgba(46, 196, 182, 0.15)" },
      },
    ],
  }
}

export function buildTokensByModelOption(sessions: SessionAnalytics[]): echarts.EChartsOption {
  const modelMap = new Map<string, { tokensIn: number; tokensOut: number; tokensCached: number }>()

  for (const s of sessions) {
    const model = s.model || "unknown"
    const existing = modelMap.get(model) ?? { tokensIn: 0, tokensOut: 0, tokensCached: 0 }
    existing.tokensIn += s.usage.tokensIn
    existing.tokensOut += s.usage.tokensOut
    existing.tokensCached += s.usage.tokensCached
    modelMap.set(model, existing)
  }

  const sorted = [...modelMap.entries()].sort(
    ([, a], [, b]) =>
      b.tokensIn + b.tokensOut + b.tokensCached - (a.tokensIn + a.tokensOut + a.tokensCached)
  )
  const models = sorted.map(([m]) => m)
  const tokensIn = sorted.map(([, v]) => v.tokensIn)
  const tokensOut = sorted.map(([, v]) => v.tokensOut)
  const cached = sorted.map(([, v]) => v.tokensCached)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      data: ["Tokens In", "Tokens Out", "Cached"],
      textStyle: { color: CHART_MUTED_COLOR },
    },
    xAxis: {
      type: "category",
      data: models,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR, rotate: models.length > 4 ? 30 : 0 },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    series: [
      {
        name: "Tokens In",
        type: "bar",
        stack: "tokens",
        data: tokensIn,
        itemStyle: { color: CHART_COLOR_02 },
      },
      {
        name: "Tokens Out",
        type: "bar",
        stack: "tokens",
        data: tokensOut,
        itemStyle: { color: CHART_COLOR_05 },
      },
      {
        name: "Cached",
        type: "bar",
        stack: "tokens",
        data: cached,
        itemStyle: { color: CHART_COLOR_01 },
      },
    ],
  }
}

export function buildSessionsBySkillOption(sessions: SessionAnalytics[]): echarts.EChartsOption {
  const skillMap = new Map<string, number>()

  for (const s of sessions) {
    const skill = s.skill || "unknown"
    skillMap.set(skill, (skillMap.get(skill) ?? 0) + 1)
  }

  const pieData = [...skillMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({
      name,
      value,
      itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
    }))

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical" as const,
      right: "5%",
      top: "center",
      textStyle: { color: CHART_MUTED_COLOR },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["40%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "rgba(10, 19, 29, 0.88)", borderWidth: 2 },
        label: {
          show: true,
          color: CHART_MUTED_COLOR,
          formatter: "{b}\n{d}%",
        },
        data: pieData,
      },
    ],
  }
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOURS_IN_DAY = 24
const HEATMAP_MIN_OPACITY = 0

export function buildActivityHeatmapOption(sessions: SessionAnalytics[]): echarts.EChartsOption {
  // Build a 7×24 matrix: [dayOfWeek, hour, count]
  const matrix: number[][] = []
  const countGrid = Array.from({ length: 7 }, () => Array.from({ length: HOURS_IN_DAY }, () => 0))

  for (const s of sessions) {
    if (!s.startedAt) continue
    const date = new Date(s.startedAt)
    if (Number.isNaN(date.getTime())) continue
    const dow = date.getDay() // 0=Sun
    const hour = date.getHours()
    countGrid[dow][hour] += s.usage.requests || 1
  }

  let maxCount = 0
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
      const count = countGrid[dow][hour]
      matrix.push([hour, dow, count])
      if (count > maxCount) maxCount = count
    }
  }

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      formatter: (params: unknown) => {
        const p = params as { value: number[] }
        const hour = p.value[0]
        const day = DAYS_OF_WEEK[p.value[1]]
        const count = p.value[2]
        return `${day} ${String(hour).padStart(2, "0")}:00 — ${count} requests`
      },
    },
    grid: {
      left: "8%",
      right: "12%",
      bottom: "10%",
      top: "6%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: HOURS_IN_DAY }, (_, i) => String(i).padStart(2, "0")),
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
      splitArea: { show: true, areaStyle: { color: ["transparent", "rgba(151,177,205,0.04)"] } },
    },
    yAxis: {
      type: "category",
      data: DAYS_OF_WEEK,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
    },
    visualMap: {
      min: HEATMAP_MIN_OPACITY,
      max: maxCount || 1,
      calculable: true,
      orient: "vertical" as const,
      right: "2%",
      top: "center",
      inRange: {
        color: ["#0a131d", CHART_COLOR_09, CHART_COLOR_02, CHART_COLOR_01],
      },
      textStyle: { color: CHART_MUTED_COLOR },
    },
    series: [
      {
        type: "heatmap",
        data: matrix,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" },
        },
      },
    ],
  }
}

export function buildRequestsByEpicOption(epics: EpicAnalytics[]): echarts.EChartsOption {
  const sorted = [...epics].sort((a, b) => b.usage.requests - a.usage.requests)
  const epicIds = sorted.map((e) => e.epicId)
  const requests = sorted.map((e) => e.usage.requests)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "category",
      data: epicIds,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR, rotate: epicIds.length > 4 ? 30 : 0 },
    },
    yAxis: {
      type: "value",
      name: "Requests",
      nameTextStyle: { color: CHART_MUTED_COLOR },
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    series: [
      {
        type: "bar",
        data: requests.map((v, i) => ({
          value: v,
          itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        })),
        barMaxWidth: 40,
      },
    ],
  }
}

// ── Quality chart colors ───────────────────────────────────────────

const QUALITY_COLOR_ONESHOT = "#2ec4b6" // var(--status-done)
const QUALITY_COLOR_CORRECTED = "#22c55e" // var(--status-progress)
const QUALITY_COLOR_ABORTED = "#ff9f1c" // var(--highlight-2)
const QUALITY_COLOR_NOOUTPUT = "#6b7280" // var(--status-backlog)

// ── Quality chart builders ─────────────────────────────────────────

export function buildOneShotRateBySkillOption(quality: AnalyticsQuality): echarts.EChartsOption {
  const rate = (v: { oneShot: number; sessions: number }) =>
    v.sessions > 0 ? v.oneShot / v.sessions : 0
  const sorted = Object.entries(quality.bySkill).sort(([, a], [, b]) => rate(b) - rate(a))
  const names = sorted.map(([k]) => k)
  const rates = sorted.map(([, v]) => rate(v))
  const sessions = sorted.map(([, v]) => v.sessions)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = params as Array<{ dataIndex: number }>
        const idx = p[0].dataIndex
        return `${names[idx]}<br/>${Math.round(rates[idx] * 100)}% one-shot (${sessions[idx]} sessions)`
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: {
        color: CHART_MUTED_COLOR,
        formatter: (v: number) => `${Math.round(v * 100)}%`,
      },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    yAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
    },
    series: [
      {
        type: "bar",
        data: rates,
        itemStyle: { color: QUALITY_COLOR_ONESHOT },
        barMaxWidth: 32,
      },
    ],
  }
}

export function buildOneShotRateByModelOption(quality: AnalyticsQuality): echarts.EChartsOption {
  const rate = (v: { oneShot: number; sessions: number }) =>
    v.sessions > 0 ? v.oneShot / v.sessions : 0
  const sorted = Object.entries(quality.byModel).sort(([, a], [, b]) => rate(b) - rate(a))
  const names = sorted.map(([k]) => k)
  const rates = sorted.map(([, v]) => rate(v))
  const sessions = sorted.map(([, v]) => v.sessions)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = params as Array<{ dataIndex: number }>
        const idx = p[0].dataIndex
        return `${names[idx]}<br/>${Math.round(rates[idx] * 100)}% one-shot (${sessions[idx]} sessions)`
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: {
        color: CHART_MUTED_COLOR,
        formatter: (v: number) => `${Math.round(v * 100)}%`,
      },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    yAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
    },
    series: [
      {
        type: "bar",
        data: rates,
        itemStyle: { color: QUALITY_COLOR_ONESHOT },
        barMaxWidth: 32,
      },
    ],
  }
}

export function buildSessionsBySkillStackedOption(
  quality: AnalyticsQuality
): echarts.EChartsOption {
  const sorted = Object.entries(quality.bySkill).sort(([, a], [, b]) => b.sessions - a.sessions)
  const names = sorted.map(([k]) => k)
  const oneShotData = sorted.map(([, v]) => v.oneShot)
  const correctedData = sorted.map(([, v]) => v.corrected)
  const abortedData = sorted.map(([, v]) => v.aborted)
  const noOutputData = sorted.map(([, v]) => v.sessions - v.oneShot - v.corrected - v.aborted)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      data: ["One-Shot", "Corrected", "Aborted", "No-Output"],
      textStyle: { color: CHART_MUTED_COLOR },
    },
    xAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR, rotate: names.length > 4 ? 30 : 0 },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
      splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
    },
    series: [
      {
        name: "One-Shot",
        type: "bar",
        stack: "sessions",
        data: oneShotData,
        itemStyle: { color: QUALITY_COLOR_ONESHOT },
      },
      {
        name: "Corrected",
        type: "bar",
        stack: "sessions",
        data: correctedData,
        itemStyle: { color: QUALITY_COLOR_CORRECTED },
      },
      {
        name: "Aborted",
        type: "bar",
        stack: "sessions",
        data: abortedData,
        itemStyle: { color: QUALITY_COLOR_ABORTED },
      },
      {
        name: "No-Output",
        type: "bar",
        stack: "sessions",
        data: noOutputData,
        itemStyle: { color: QUALITY_COLOR_NOOUTPUT },
      },
    ],
  }
}
