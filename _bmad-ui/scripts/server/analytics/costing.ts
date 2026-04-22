// ── Analytics Costing Domain ──────────────────────────────────────────────
// Types, constants, and pure functions for analytics costing and token parsing.

export type AgentSession = {
  session_id?: string
  storyId?: string | null
  tool: string
  model: string
  premium: boolean
  premium_requests: number
  premium_multiplier: number
  premium_cost_units: number
  tokens: { input: number; output: number; total: number }
  agent: string
  turns: number
  status: "running" | "completed"
  start_date: string
  end_date: string | null
  notes?: string
}

export type TokenUsageData = {
  requests: number
  tokensIn: number
  tokensOut: number
  tokensCached: number
  totalTokens: number
}

export type SessionAnalyticsData = {
  sessionId: string
  storyId: string | null
  epicId: string | null
  skill: string
  model: string
  status: string
  startedAt: string
  endedAt: string | null
  usage: TokenUsageData
  // Operational fields — present for BMAD-launched sessions, absent for VS Code sessions
  logPath?: string | null
  promptPath?: string | null
  command?: string | null
  worktreePath?: string | null
  exitCode?: number | null
  error?: string | null
  userMessages?: Array<{ id: string; text: string; sentAt: string }>
  // Quality fields — populated by story 10-1 sync daemon; absent for pre-10-1 data
  human_turns?: number | null
  agent_turns?: number | null
  outcome?: string | null
  aborted?: boolean | null
  duration_minutes?: number | null
}

export type AnalyticsRatesUsdData = {
  premiumRequest: number | null
  inputPer1MTokens: number | null
  outputPer1MTokens: number | null
  cachedInputPer1MTokens: number | null
}

export type AnalyticsEstimatedCostUsdData = {
  seatCostPerUserPerMonth: number | null
  fromPremiumRequests: number | null
  fromTokens: number | null
  totalWithKnownRates: number | null
}

export type AnalyticsCostingData = {
  version: number
  copilotBilling: {
    primaryUnit: string
    notes: string
    source: string
  }
  subscription: {
    plan: string
    seatUsdPerUserPerMonth: number
    seatPriceSource: string
  } | null
  totals: {
    premiumRequests: number
    tokensIn: number
    tokensOut: number
    tokensCached: number
    totalTokens: number
  }
  ratesUsd: AnalyticsRatesUsdData
  estimatedCostUsd: AnalyticsEstimatedCostUsdData
}

export const DEFAULT_STAGE_MODELS = {
  planning: "claude-sonnet-4.6",
  retrospective: "claude-sonnet-4.6",
} as const

export const DEFAULT_WORKFLOW_MODEL = "claude-sonnet-4.6"

export const SKILL_MODEL_OVERRIDES: Record<string, string> = {
  "bmad-code-review": "gpt-5.3-codex",
}

// Regex constants used for parsing analytics log content
export const ANALYTICS_REQUESTS_LINE_REGEX = /^Requests\s+([\d.]+)/m
export const ANALYTICS_TOKENS_LINE_REGEX =
  /^Tokens\s+\u2191\s*([\d.]+)([kmb]?)\s*\u2022\s*\u2193\s*([\d.]+)([kmb]?)\s*\u2022\s*([\d.]+)([kmb]?)\s*\(cached\)/m

export function zeroUsage(): TokenUsageData {
  return {
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
    tokensCached: 0,
    totalTokens: 0,
  }
}

export function addUsage(a: TokenUsageData, b: TokenUsageData): TokenUsageData {
  return {
    requests: a.requests + b.requests,
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    tokensCached: a.tokensCached + b.tokensCached,
    totalTokens: a.totalTokens + b.totalTokens,
  }
}

export function toNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  return value
}

export function normalizeAnalyticsCosting(
  rawCosting: unknown,
  projectUsage: TokenUsageData,
): AnalyticsCostingData {
  const fallbackRates: AnalyticsRatesUsdData = {
    premiumRequest: null,
    inputPer1MTokens: null,
    outputPer1MTokens: null,
    cachedInputPer1MTokens: null,
  }

  const raw =
    rawCosting && typeof rawCosting === "object"
      ? (rawCosting as Record<string, unknown>)
      : {}

  const rawRates =
    raw.ratesUsd && typeof raw.ratesUsd === "object"
      ? (raw.ratesUsd as Record<string, unknown>)
      : {}

  const rates: AnalyticsRatesUsdData = {
    premiumRequest: toNullableNumber(rawRates.premiumRequest),
    inputPer1MTokens: toNullableNumber(rawRates.inputPer1MTokens),
    outputPer1MTokens: toNullableNumber(rawRates.outputPer1MTokens),
    cachedInputPer1MTokens: toNullableNumber(rawRates.cachedInputPer1MTokens),
  }

  const rawSubscription =
    raw.subscription && typeof raw.subscription === "object"
      ? (raw.subscription as Record<string, unknown>)
      : null

  const subscription = rawSubscription
    ? {
        plan:
          typeof rawSubscription.plan === "string"
            ? rawSubscription.plan
            : "copilot_enterprise_standard",
        seatUsdPerUserPerMonth:
          toNullableNumber(rawSubscription.seatUsdPerUserPerMonth) ?? 39,
        seatPriceSource:
          typeof rawSubscription.seatPriceSource === "string"
            ? rawSubscription.seatPriceSource
            : "https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/choosing-your-enterprises-plan-for-github-copilot",
      }
    : {
        plan: "copilot_enterprise_standard",
        seatUsdPerUserPerMonth: 39,
        seatPriceSource:
          "https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/choosing-your-enterprises-plan-for-github-copilot",
      }

  const fromPremiumRequests =
    rates.premiumRequest === null
      ? null
      : Number((projectUsage.requests * rates.premiumRequest).toFixed(4))

  const billableInput = Math.max(
    projectUsage.tokensIn - projectUsage.tokensCached,
    0,
  )
  const canEstimateTokens =
    rates.inputPer1MTokens !== null &&
    rates.outputPer1MTokens !== null &&
    rates.cachedInputPer1MTokens !== null
  const inputRate = rates.inputPer1MTokens ?? 0
  const outputRate = rates.outputPer1MTokens ?? 0
  const cachedInputRate = rates.cachedInputPer1MTokens ?? 0
  const fromTokens = canEstimateTokens
    ? Number(
        (
          (billableInput / 1_000_000) * inputRate +
          (projectUsage.tokensOut / 1_000_000) * outputRate +
          (projectUsage.tokensCached / 1_000_000) * cachedInputRate
        ).toFixed(4),
      )
    : null

  const seatCostPerUserPerMonth =
    toNullableNumber(
      raw.estimatedCostUsd &&
        typeof raw.estimatedCostUsd === "object" &&
        (raw.estimatedCostUsd as Record<string, unknown>).seatCostPerUserPerMonth,
    ) ?? subscription.seatUsdPerUserPerMonth

  const usageEstimate = fromPremiumRequests ?? fromTokens

  return {
    version: toNullableNumber(raw.version) ?? 1,
    copilotBilling: {
      primaryUnit:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).primaryUnit === "string"
          ? ((raw.copilotBilling as Record<string, unknown>).primaryUnit as string)
          : "premium_requests",
      notes:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).notes === "string"
          ? ((raw.copilotBilling as Record<string, unknown>).notes as string)
          : "GitHub Copilot subscriptions are primarily billed via premium requests. Token counters are retained for analytics and optional estimation.",
      source:
        raw.copilotBilling &&
        typeof raw.copilotBilling === "object" &&
        typeof (raw.copilotBilling as Record<string, unknown>).source === "string"
          ? ((raw.copilotBilling as Record<string, unknown>).source as string)
          : "https://docs.github.com/en/copilot/concepts/copilot-billing/requests-in-github-copilot",
    },
    subscription,
    totals: {
      premiumRequests: projectUsage.requests,
      tokensIn: projectUsage.tokensIn,
      tokensOut: projectUsage.tokensOut,
      tokensCached: projectUsage.tokensCached,
      totalTokens: projectUsage.totalTokens,
    },
    ratesUsd: rates || fallbackRates,
    estimatedCostUsd: {
      seatCostPerUserPerMonth,
      fromPremiumRequests,
      fromTokens,
      totalWithKnownRates:
        usageEstimate === null
          ? seatCostPerUserPerMonth
          : Number((seatCostPerUserPerMonth + usageEstimate).toFixed(4)),
    },
  }
}

export function parseTokenCount(value: string, unit: string): number {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) {
    return 0
  }
  const u = unit.toLowerCase()
  if (u === "k") {
    return Math.round(n * 1000)
  }
  if (u === "m") {
    return Math.round(n * 1_000_000)
  }
  if (u === "b") {
    return Math.round(n * 1_000_000_000)
  }
  return Math.round(n)
}

function stripAnsi(value: string): string {
  let cleaned = ""
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index]
    if (current === "\u001b" && value[index + 1] === "[") {
      index += 2
      while (index < value.length && value[index] !== "m") {
        index += 1
      }
      continue
    }
    cleaned += current
  }
  return cleaned
}

export function parseTokenUsageFromLog(rawLogContent: string): TokenUsageData {
  const clean = stripAnsi(rawLogContent).replace(/\r/g, "")

  const reqMatch = clean.match(ANALYTICS_REQUESTS_LINE_REGEX)
  const parsedRequests = reqMatch ? Number.parseFloat(reqMatch[1]) : 0
  const requests = Number.isFinite(parsedRequests) ? parsedRequests : 0

  const tokMatch = clean.match(ANALYTICS_TOKENS_LINE_REGEX)
  if (!tokMatch) {
    return {
      requests,
      tokensIn: 0,
      tokensOut: 0,
      tokensCached: 0,
      totalTokens: 0,
    }
  }

  const tokensIn = parseTokenCount(tokMatch[1], tokMatch[2])
  const tokensOut = parseTokenCount(tokMatch[3], tokMatch[4])
  const tokensCached = parseTokenCount(tokMatch[5], tokMatch[6])
  const totalTokens = tokensIn + tokensOut

  return { requests, tokensIn, tokensOut, tokensCached, totalTokens }
}
