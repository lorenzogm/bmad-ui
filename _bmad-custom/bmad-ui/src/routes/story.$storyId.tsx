import { createRoute, Link, useParams } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { storyStepLabel } from "../app"
import type { StoryDetailResponse, StoryPreviewResponse, WorkflowStepState } from "../types"
import { rootRoute } from "./__root"

const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/

function parseStoryTicket(storyId: string): string {
  const match = storyId.match(STORY_TICKET_REGEX)
  if (!match) {
    return storyId
  }
  return `Story ${match[1]}.${match[2]}`
}

function extractFileList(markdown: string | null): string[] {
  if (!markdown) {
    return []
  }
  const fileListMatch = markdown.match(/#{2,3}\s+File\s+List\s*\n([\s\S]*?)(?=\n#{2,3}\s|\n##\s|$)/)
  if (!fileListMatch) {
    return []
  }
  const section = fileListMatch[1].trim()
  if (!section) {
    return []
  }
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
}

function renderMarkdownContent(text: string) {
  const lines = text.split("\n")
  const elements: Array<{ key: string; node: React.ReactNode }> = []
  let listBuffer: string[] = []
  let blockIndex = 0

  const flushList = () => {
    if (listBuffer.length === 0) {
      return
    }
    elements.push({
      key: `list-${blockIndex}`,
      node: (
        <ul
          className="mt-2 mb-3 ml-4 space-y-1"
          key={`list-${blockIndex}`}
          style={{ listStyleType: "disc", color: "var(--text)" }}
        >
          {listBuffer.map((item) => (
            <li key={`${blockIndex}-${item.slice(0, 32)}`} style={{ color: "var(--muted)" }}>
              {item}
            </li>
          ))}
        </ul>
      ),
    })
    blockIndex += 1
    listBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.slice(2))
      continue
    }

    flushList()

    if (trimmed === "") {
      continue
    }

    if (
      trimmed.startsWith("**Given") ||
      trimmed.startsWith("**When") ||
      trimmed.startsWith("**Then")
    ) {
      elements.push({
        key: `ac-${blockIndex}`,
        node: (
          <p key={`ac-${blockIndex}`} className="my-1 ml-4" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--highlight)" }}>
              {trimmed.match(/^\*\*(\w+)\*\*/)?.[0]?.replace(/\*\*/g, "") ?? ""}
            </span>{" "}
            {trimmed.replace(/^\*\*\w+\*\*\s*/, "")}
          </p>
        ),
      })
      blockIndex += 1
      continue
    }

    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      elements.push({
        key: `bold-${blockIndex}`,
        node: (
          <h3
            key={`bold-${blockIndex}`}
            className="mt-6 mb-2"
            style={{ color: "var(--highlight)", fontSize: "0.95rem", fontWeight: 600 }}
          >
            {trimmed.replace(/\*\*/g, "")}
          </h3>
        ),
      })
      blockIndex += 1
      continue
    }

    elements.push({
      key: `p-${blockIndex}`,
      node: (
        <p
          key={`p-${blockIndex}`}
          className="my-2"
          style={{ color: "var(--muted)", lineHeight: 1.7 }}
        >
          {trimmed}
        </p>
      ),
    })
    blockIndex += 1
  }

  flushList()

  return elements.map((el) => el.node)
}

function SectionHeader(props: { title: string; state: WorkflowStepState; stepNumber: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "50%",
            background: "rgba(46, 196, 182, 0.15)",
            color: "var(--highlight)",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          {props.stepNumber}
        </span>
        <h2 style={{ margin: 0, color: "var(--text)" }}>{props.title}</h2>
      </div>
      <span className={`step-badge step-${props.state}`}>{storyStepLabel(props.state)}</span>
    </div>
  )
}

function StoryDetailPage() {
  const { storyId } = useParams({ from: "/story/$storyId" })
  const [data, setData] = useState<StoryDetailResponse | null>(null)
  const [preview, setPreview] = useState<StoryPreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const storyLabel = parseStoryTicket(storyId)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [detailRes, previewRes] = await Promise.all([
          fetch(`/api/story/${encodeURIComponent(storyId)}`),
          fetch(`/api/story-preview/${encodeURIComponent(storyId)}`),
        ])
        if (!detailRes.ok) {
          throw new Error(`detail request failed: ${detailRes.status}`)
        }
        const detailPayload = (await detailRes.json()) as StoryDetailResponse
        const previewPayload = previewRes.ok
          ? ((await previewRes.json()) as StoryPreviewResponse)
          : null
        if (mounted) {
          setData(detailPayload)
          setPreview(previewPayload)
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

  const createStoryStep = data.steps.find((s) => s.skill === "bmad-create-story")
  const devStoryStep = data.steps.find((s) => s.skill === "bmad-dev-story")
  const codeReviewStep = data.steps.find((s) => s.skill === "bmad-code-review")
  const fileList = extractFileList(data.story.markdownContent)

  return (
    <main className="screen">
      {/* Header */}
      <section className="panel reveal">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/">
            ← Back to Dashboard
          </Link>
        </div>
        <p className="eyebrow">{storyLabel}</p>
        <h1 className="epic-title">
          {preview?.planning?.title || data.story.id}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
          <span
            className={`step-badge step-${data.story.status === "done" ? "done" : data.story.status === "in-progress" ? "running" : data.story.status === "review" ? "running" : "not-started"}`}
          >
            {data.story.status}
          </span>
          {data.story.markdownPath ? (
            <span className="subtitle" style={{ fontSize: "0.8rem" }}>
              {data.story.markdownPath}
            </span>
          ) : null}
        </div>
      </section>

      {/* 1. Create Story — Acceptance Criteria */}
      <section className="panel reveal delay-1" style={{ marginTop: "1rem" }}>
        <SectionHeader
          stepNumber={1}
          title="Create Story"
          state={createStoryStep?.state ?? "not-started"}
        />
        {preview?.planning ? (
          <div
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            {renderMarkdownContent(preview.planning.content)}
          </div>
        ) : (
          <p style={{ color: "var(--muted)", padding: "1rem 0", textAlign: "center" }}>
            No acceptance criteria found in epics.md.
          </p>
        )}
        {createStoryStep?.summary ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
            {createStoryStep.summary}
          </p>
        ) : null}
      </section>

      {/* 2. Dev Story — Implementation Specification */}
      <section className="panel reveal delay-2" style={{ marginTop: "1rem" }}>
        <SectionHeader
          stepNumber={2}
          title="Dev Story"
          state={devStoryStep?.state ?? "not-started"}
        />
        {data.story.markdownContent ? (
          <div
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxHeight: "32rem",
              overflowY: "auto",
            }}
          >
            <pre
              style={{
                color: "var(--muted)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "0.85rem",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {data.story.markdownContent}
            </pre>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", padding: "1rem 0", textAlign: "center" }}>
            No implementation specification created yet.
          </p>
        )}
        {devStoryStep?.summary ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
            {devStoryStep.summary}
          </p>
        ) : null}
      </section>

      {/* 3. Code Review — Files Changed */}
      <section className="panel reveal delay-3" style={{ marginTop: "1rem" }}>
        <SectionHeader
          stepNumber={3}
          title="Code Review"
          state={codeReviewStep?.state ?? "not-started"}
        />
        {fileList.length > 0 ? (
          <div
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              borderRadius: "8px",
              padding: "1.25rem",
            }}
          >
            <ul style={{ listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {fileList.map((file) => {
                const dashIdx = file.indexOf(" — ")
                const filePath = dashIdx > 0 ? file.slice(0, dashIdx).replace(/`/g, "") : file.replace(/`/g, "")
                const description = dashIdx > 0 ? file.slice(dashIdx + 3) : null
                return (
                  <li
                    key={file}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.5rem",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid rgba(151, 177, 205, 0.1)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--highlight)",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "0.85rem",
                        flexShrink: 0,
                      }}
                    >
                      {filePath}
                    </span>
                    {description ? (
                      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        {description}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", padding: "1rem 0", textAlign: "center" }}>
            No files recorded yet.
          </p>
        )}
        {codeReviewStep?.summary ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.75rem" }}>
            {codeReviewStep.summary}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export const storyDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/story/$storyId",
  component: StoryDetailPage,
})
