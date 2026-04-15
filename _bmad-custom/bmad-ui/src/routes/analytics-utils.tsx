import { useEffect, useState } from "react"
import type { AnalyticsCosting, AnalyticsResponse, TokenUsage } from "../types"

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

export function AnalyticsCostBanner({
  costing,
}: {
  costing: AnalyticsCosting
}) {
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

export function UsageBar({
  usage,
  maxTotal,
}: {
  usage: TokenUsage
  maxTotal: number
}) {
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

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
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
