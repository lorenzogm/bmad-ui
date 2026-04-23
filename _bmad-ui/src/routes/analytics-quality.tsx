import { useQuery } from "@tanstack/react-query"
import { createRoute } from "@tanstack/react-router"
import { marked } from "marked"
import { apiUrl } from "../lib/mode"
import type { AnalyticsQuality, SkillModelQualityCell } from "../types"
import { analyticsLayoutRoute } from "./analytics"
import {
  buildOneShotRateByModelOption,
  buildOneShotRateBySkillOption,
  buildSessionsBySkillStackedOption,
  EChart,
  StatCard,
  useAnalyticsData,
} from "./analytics-utils"

const MIN_CONFIDENCE_SESSIONS = 3
const CELL_SEPARATOR = "|||"
const LEGACY_CELL_SEPARATOR = "::"
const RATE_PCT_MULTIPLIER = 100
const WORKFLOW_CONFIG_FILENAME = "autonomous-workflow-config.yaml"

type QualityConfigResponse = {
  yaml: string
  metadata: {
    generatedAt: string
    totalSessions: number
    dataCoverage: number
  }
}

function parseSkillModelKey(key: string): { skill: string; model: string } | null {
  const separators = [CELL_SEPARATOR, LEGACY_CELL_SEPARATOR]
  for (const separator of separators) {
    const sepIdx = key.indexOf(separator)
    if (sepIdx === -1) continue
    return {
      skill: key.slice(0, sepIdx),
      model: key.slice(sepIdx + separator.length),
    }
  }
  return null
}

function parseCells(
  bySkillModel: NonNullable<AnalyticsQuality["bySkillModel"]>
): SkillModelQualityCell[] {
  return Object.entries(bySkillModel).flatMap(([key, metric]) => {
    const parsed = parseSkillModelKey(key)
    if (!parsed) return []
    return [{ ...metric, skill: parsed.skill, model: parsed.model }]
  })
}

function getBestModel(cells: SkillModelQualityCell[], skill: string): SkillModelQualityCell | null {
  const qualified = cells
    .filter((c) => c.skill === skill && c.sessions >= MIN_CONFIDENCE_SESSIONS)
    .sort((a, b) => b.oneShotRate - a.oneShotRate)
  return qualified[0] ?? null
}

function cellBg(oneShotRate: number, hasData: boolean): string {
  if (!hasData) return "var(--status-backlog)"
  return `color-mix(in srgb, var(--status-done) ${Math.round(oneShotRate * RATE_PCT_MULTIPLIER)}%, var(--highlight-2))`
}

function EffectivenessMatrix({ cells }: { cells: SkillModelQualityCell[] }) {
  if (cells.length === 0) {
    return (
      <p className="text-[var(--muted)] text-sm">
        Run sync-sessions to populate session quality metrics
      </p>
    )
  }

  const skills = [...new Set(cells.map((c) => c.skill))].sort()
  const models = [...new Set(cells.map((c) => c.model))].sort()
  const cellMap = new Map<string, SkillModelQualityCell>()
  for (const c of cells) {
    cellMap.set(`${c.skill}${CELL_SEPARATOR}${c.model}`, c)
  }

  const thStyle = {
    padding: "6px 12px",
    color: "var(--muted)",
    fontSize: "0.75rem",
    border: "1px solid rgba(151, 177, 205, 0.22)",
    background: "rgba(2, 10, 16, 0.66)",
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>Skill</th>
            {models.map((model) => (
              <th
                key={model}
                title={model}
                style={{ ...thStyle, textAlign: "center", maxWidth: "120px", whiteSpace: "nowrap" }}
              >
                {model.length > 20 ? `${model.slice(0, 18)}…` : model}
              </th>
            ))}
            <th style={{ ...thStyle, textAlign: "center", color: "var(--highlight)" }}>
              Best Model
            </th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => {
            const best = getBestModel(cells, skill)
            return (
              <tr key={skill}>
                <td
                  style={{
                    padding: "6px 12px",
                    color: "var(--text)",
                    fontSize: "0.8rem",
                    border: "1px solid rgba(151, 177, 205, 0.22)",
                    background: "rgba(2, 10, 16, 0.66)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {skill}
                </td>
                {models.map((model) => {
                  const cell = cellMap.get(`${skill}${CELL_SEPARATOR}${model}`)
                  const hasData = !!cell
                  const isLow = hasData && cell.sessions < MIN_CONFIDENCE_SESSIONS
                  const tooltip = cell
                    ? [
                        `${skill} × ${model}`,
                        `Sessions: ${cell.sessions}`,
                        `One-shot: ${cell.oneShot} (${Math.round(cell.oneShotRate * RATE_PCT_MULTIPLIER)}%)`,
                        cell.avgDurationMin != null
                          ? `Avg duration: ${cell.avgDurationMin.toFixed(1)} min`
                          : null,
                        cell.avgHumanTurns != null
                          ? `Avg human turns: ${cell.avgHumanTurns.toFixed(1)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : `${skill} × ${model}: no data`
                  return (
                    <td
                      key={model}
                      title={tooltip}
                      style={{
                        padding: "6px 12px",
                        textAlign: "center",
                        fontSize: "0.75rem",
                        border: isLow
                          ? "1px dashed rgba(151, 177, 205, 0.4)"
                          : "1px solid rgba(151, 177, 205, 0.22)",
                        background: cellBg(cell?.oneShotRate ?? 0, hasData),
                        color: hasData ? "rgba(10, 19, 29, 0.9)" : "var(--muted)",
                        opacity: isLow ? 0.6 : 1,
                      }}
                    >
                      {hasData ? `${Math.round(cell.oneShotRate * RATE_PCT_MULTIPLIER)}%` : "—"}
                    </td>
                  )
                })}
                <td
                  style={{
                    padding: "6px 12px",
                    textAlign: "center",
                    fontSize: "0.75rem",
                    border: "1px solid rgba(151, 177, 205, 0.22)",
                    background: "rgba(2, 10, 16, 0.66)",
                    color: best ? "var(--highlight)" : "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {best
                    ? `${best.model} (${Math.round(best.oneShotRate * RATE_PCT_MULTIPLIER)}%)`
                    : "Insufficient data"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BestModelTable({ cells }: { cells: SkillModelQualityCell[] }) {
  if (cells.length === 0) return null

  const skills = [...new Set(cells.map((c) => c.skill))].sort()
  const headers = ["Skill", "Best Model", "One-Shot Rate", "Sessions"] as const
  const tdBase = {
    padding: "6px 12px",
    fontSize: "0.8rem",
    border: "1px solid rgba(151, 177, 205, 0.22)",
    background: "rgba(2, 10, 16, 0.66)",
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 12px",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  border: "1px solid rgba(151, 177, 205, 0.22)",
                  background: "rgba(2, 10, 16, 0.66)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => {
            const best = getBestModel(cells, skill)
            return (
              <tr key={skill}>
                <td style={{ ...tdBase, color: "var(--text)" }}>{skill}</td>
                <td style={{ ...tdBase, color: best ? "var(--highlight)" : "var(--muted)" }}>
                  {best?.model ?? "—"}
                </td>
                <td style={{ ...tdBase, color: best ? "var(--text)" : "var(--muted)" }}>
                  {best
                    ? `${Math.round(best.oneShotRate * RATE_PCT_MULTIPLIER)}%`
                    : "Insufficient data"}
                </td>
                <td style={{ ...tdBase, color: best ? "var(--text)" : "var(--muted)" }}>
                  {String(best?.sessions ?? "—")}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

async function fetchQualityConfig(): Promise<QualityConfigResponse> {
  const response = await fetch(apiUrl("/api/analytics/quality-config"))
  if (!response.ok) {
    throw new Error(`Failed to load quality config (${response.status})`)
  }
  return (await response.json()) as QualityConfigResponse
}

function downloadYaml(yaml: string) {
  const blob = new Blob([yaml], { type: "text/yaml" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = WORKFLOW_CONFIG_FILENAME
  anchor.click()
  URL.revokeObjectURL(url)
}

function WorkflowConfigSection() {
  const qualityConfigQuery = useQuery({
    queryKey: ["analytics", "quality-config"],
    queryFn: fetchQualityConfig,
    enabled: false,
  })

  const yaml = qualityConfigQuery.data?.yaml ?? ""
  const renderedYaml = yaml ? String(marked.parse(`\`\`\`yaml\n${yaml}\n\`\`\``)) : ""
  const hasInsufficientData = qualityConfigQuery.data?.metadata.totalSessions === 0

  return (
    <section className="panel reveal delay-3">
      <h3>Autonomous Workflow Configuration</h3>
      <p className="subtitle">
        Generate a recommended model-per-skill YAML configuration from historical session
        effectiveness data.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="cta" onClick={() => void qualityConfigQuery.refetch()} type="button">
          Generate Config
        </button>
        {yaml && (
          <>
            <button
              className="ghost"
              onClick={() => void navigator.clipboard.writeText(yaml)}
              type="button"
            >
              Copy
            </button>
            <button className="ghost" onClick={() => downloadYaml(yaml)} type="button">
              Download
            </button>
          </>
        )}
      </div>
      {qualityConfigQuery.isError && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Failed to generate configuration. Please try again.
        </p>
      )}
      {hasInsufficientData && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Not enough quality data yet. Run more sessions to build recommendations.
        </p>
      )}
      {yaml && (
        <div
          className="story-markdown mt-4 rounded border border-[var(--panel-border)] bg-[rgba(2,10,16,0.66)] p-4 text-[var(--text)]"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered from trusted local analytics payload
          dangerouslySetInnerHTML={{ __html: renderedYaml }}
        />
      )}
    </section>
  )
}

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
  const oneShotRate =
    overall.sessions > 0 ? Math.round((overall.oneShot / overall.sessions) * 100) : 0

  const matrixCells = quality.bySkillModel ? parseCells(quality.bySkillModel) : []

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

      <section className="panel reveal delay-3">
        <h3>Skill × Model Effectiveness Matrix</h3>
        <p className="subtitle" style={{ marginBottom: "1rem" }}>
          Green = high one-shot rate, amber = low. Dashed border = fewer than{" "}
          {MIN_CONFIDENCE_SESSIONS} sessions (low confidence).
        </p>
        <EffectivenessMatrix cells={matrixCells} />
      </section>

      {matrixCells.length > 0 && (
        <section className="panel reveal delay-3">
          <h3>Best Model per Skill</h3>
          <p className="subtitle" style={{ marginBottom: "1rem" }}>
            Best model requires ≥ {MIN_CONFIDENCE_SESSIONS} sessions.
          </p>
          <BestModelTable cells={matrixCells} />
        </section>
      )}

      <WorkflowConfigSection />
    </main>
  )
}

export const analyticsQualityRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "quality",
  component: AnalyticsQualityPage,
})
