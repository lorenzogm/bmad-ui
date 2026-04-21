import { useQuery } from "@tanstack/react-query"
import { createRoute, Link, useParams } from "@tanstack/react-router"
import { marked } from "marked"
import { useMemo } from "react"
import { StatusBadge } from "../app"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import type { WorkflowStepDetailResponse } from "../types"
import { workflowLayoutRoute } from "./workflow"

const SUPPORTED_DETAIL_SLUGS = new Set(["planning/prd", "planning/ux", "solutioning/architecture"])

function ArtifactSection(props: { artifact: WorkflowStepDetailResponse["artifact"] }) {
  const { artifact } = props

  const html = useMemo(() => {
    if (!artifact.markdownContent) return ""
    return marked.parse(artifact.markdownContent, {
      async: false,
      gfm: true,
      breaks: false,
    }) as string
  }, [artifact.markdownContent])

  if (artifact.status === "skipped") {
    return (
      <div
        className="panel reveal delay-2"
        style={{ padding: "2rem", textAlign: "center", marginTop: "1rem" }}
      >
        <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
          Artifact
        </p>
        <p style={{ color: "var(--muted)" }}>This step was skipped — no artifact was created.</p>
      </div>
    )
  }

  if (artifact.status === "missing") {
    return (
      <div
        className="panel reveal delay-2"
        style={{ padding: "2rem", textAlign: "center", marginTop: "1rem" }}
      >
        <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
          Artifact
        </p>
        <p style={{ color: "var(--muted)" }}>No artifact has been created yet for this step.</p>
      </div>
    )
  }

  return (
    <section className="panel reveal delay-2" style={{ marginTop: "1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
          Artifact
        </p>
        {artifact.filePath ? (
          <span className="subtitle" style={{ fontSize: "0.8rem" }}>
            {artifact.filePath}
          </span>
        ) : null}
      </div>
      <div
        style={{
          background: "rgba(2, 10, 16, 0.66)",
          border: "1px solid rgba(151, 177, 205, 0.22)",
          borderRadius: "8px",
          padding: "1.5rem",
          overflowX: "auto",
        }}
      >
        {html ? (
          <div
            className="md-rendered"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: content is from local markdown files
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p style={{ color: "var(--muted)" }}>Artifact is empty.</p>
        )}
      </div>
    </section>
  )
}

function SkillSummarySection(props: { skillSummary: WorkflowStepDetailResponse["skillSummary"] }) {
  const { skillSummary } = props
  return (
    <section className="panel reveal delay-1" style={{ marginTop: "1rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
        Skill Overview
      </p>
      <p
        style={{
          color: "var(--muted)",
          marginBottom: "1.5rem",
          lineHeight: 1.7,
        }}
      >
        {skillSummary.overview}
      </p>
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
        Question Themes
      </p>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
        }}
      >
        {skillSummary.questionThemes.map((theme) => (
          <div
            key={theme.theme}
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <p
              style={{
                color: "var(--highlight)",
                fontWeight: 600,
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
              }}
            >
              {theme.theme}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {theme.questions.map((q) => (
                <li
                  key={q}
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    paddingLeft: "0.75rem",
                    borderLeft: "2px solid rgba(46,196,182,0.25)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {q}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {skillSummary.sourceFiles.length > 0 ? (
        <div style={{ marginTop: "1.25rem" }}>
          <p className="subtitle" style={{ fontSize: "0.78rem", marginBottom: "0.4rem" }}>
            Source files
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {skillSummary.sourceFiles.map((f) => (
              <li key={f}>
                <code
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    opacity: 0.75,
                  }}
                >
                  {f}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function WorkflowStepDetailPage() {
  const { phaseId, stepId } = useParams({
    from: "/workflow/$phaseId/$stepId" as const,
  })

  const slug = `${phaseId}/${stepId}`
  const isSupported = SUPPORTED_DETAIL_SLUGS.has(slug)

  const { data, isLoading, error, refetch } = useQuery<WorkflowStepDetailResponse>({
    queryKey: ["workflow-step-detail", phaseId, stepId],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/workflow-step/${phaseId}/${stepId}`))
      if (!response.ok) {
        throw new Error(`workflow step request failed: ${response.status}`)
      }
      return (await response.json()) as WorkflowStepDetailResponse
    },
    enabled: isSupported,
  })

  if (!isSupported) {
    return (
      <main className="screen">
        <section className="panel reveal">
          <Link className="epic-back-link" to="/workflow/$phaseId" params={{ phaseId }}>
            ← {phaseId.charAt(0).toUpperCase() + phaseId.slice(1)}
          </Link>
          <h1>Step not found</h1>
          <p className="subtitle">
            No detail view available for: <code>{slug}</code>
          </p>
        </section>
      </main>
    )
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error || !data) {
    return (
      <QueryErrorState message={error ? String(error) : "No data returned"} onRetry={refetch} />
    )
  }

  const artifactStatus =
    data.artifact.status === "present"
      ? "done"
      : data.artifact.status === "skipped"
        ? "skipped"
        : "not-started"

  return (
    <main className="screen">
      <section className="panel reveal">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/workflow/$phaseId" params={{ phaseId }}>
            ← {data.phase.name}
          </Link>
        </div>
        <p className="eyebrow">
          Phase {data.phase.number} · {data.phase.name}
        </p>
        <h1 className="epic-title">{data.step.name}</h1>
        <p className="epic-description">{data.step.description}</p>
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <StatusBadge status={artifactStatus} />
          {data.step.isOptional ? (
            <span className="subtitle" style={{ fontSize: "0.8rem" }}>
              optional
            </span>
          ) : null}
          <code
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              background: "rgba(151,177,205,0.08)",
              padding: "0.1rem 0.4rem",
              borderRadius: "4px",
            }}
          >
            {data.step.skill}
          </code>
        </div>
      </section>

      <SkillSummarySection skillSummary={data.skillSummary} />
      <ArtifactSection artifact={data.artifact} />
    </main>
  )
}

export const workflowStepDetailRoute = createRoute({
  getParentRoute: () => workflowLayoutRoute,
  path: "$phaseId/$stepId",
  component: WorkflowStepDetailPage,
})
