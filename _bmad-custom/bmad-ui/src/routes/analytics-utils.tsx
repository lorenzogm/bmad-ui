import * as echarts from "echarts"
import { useCallback, useEffect, useRef, useState } from "react"
import type {
  AnalyticsCosting,
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
        const response = await fetch("/api/analytics")
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
  const dayMap = new Map<string, { requests: number; tokens: number }>()

  for (const s of sessions) {
    if (!s.startedAt) continue
    const day = s.startedAt.slice(0, 10) // YYYY-MM-DD
    const existing = dayMap.get(day) ?? { requests: 0, tokens: 0 }
    existing.requests += s.usage.requests
    existing.tokens += s.usage.totalTokens
    dayMap.set(day, existing)
  }

  const sorted = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dates = sorted.map(([d]) => d)
  const requests = sorted.map(([, v]) => v.requests)
  const tokens = sorted.map(([, v]) => v.tokens)

  return {
    ...buildBaseChartOption(),
    tooltip: {
      ...buildBaseChartOption().tooltip,
      trigger: "axis",
    },
    legend: {
      data: ["Requests", "Tokens"],
      textStyle: { color: CHART_MUTED_COLOR },
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      axisLabel: { color: CHART_MUTED_COLOR },
    },
    yAxis: [
      {
        type: "value",
        name: "Requests",
        nameTextStyle: { color: CHART_MUTED_COLOR },
        axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
        axisLabel: { color: CHART_MUTED_COLOR },
        splitLine: { lineStyle: { color: CHART_BORDER_COLOR } },
      },
      {
        type: "value",
        name: "Tokens",
        nameTextStyle: { color: CHART_MUTED_COLOR },
        axisLine: { lineStyle: { color: CHART_BORDER_COLOR } },
        axisLabel: { color: CHART_MUTED_COLOR },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Requests",
        type: "line",
        smooth: true,
        data: requests,
        itemStyle: { color: CHART_COLOR_02 },
        areaStyle: { color: "rgba(46, 196, 182, 0.15)" },
      },
      {
        name: "Tokens",
        type: "line",
        smooth: true,
        yAxisIndex: 1,
        data: tokens,
        itemStyle: { color: CHART_COLOR_04 },
        areaStyle: { color: "rgba(6, 182, 212, 0.12)" },
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
