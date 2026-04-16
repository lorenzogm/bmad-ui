import { createRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { marked } from "marked"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { StoryPreviewResponse } from "../types"
import { rootRoute } from "./__root"

const HTTP_CONFLICT = 409
const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/

type PrepareStorySearch = {
  skill: "bmad-create-story" | "bmad-dev-story"
  epicId: string
}

const SKILL_CONFIG = {
  "bmad-create-story": {
    heading: "Prepare Story Creation",
    description:
      "Review the planned story below before starting the create-story workflow. This workflow will generate a detailed implementation specification from this epic story.",
    cta: "Start Create Story",
    contentKey: "planning" as const,
    emptyMessage: "No planning content found for this story in epics.md.",
  },
  "bmad-dev-story": {
    heading: "Prepare Development",
    description:
      "Review the implementation specification below before starting development. The dev agent will implement the code changes based on this specification.",
    cta: "Start Development",
    contentKey: "implementation" as const,
    emptyMessage: "No implementation specification found for this story.",
  },
}

function parseStoryTicket(storyId: string): string {
  const match = storyId.match(STORY_TICKET_REGEX)
  if (!match) {
    return storyId
  }
  return `Story ${match[1]}.${match[2]}`
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

function PrepareStoryPage() {
  const { storyId } = useParams({ from: "/prepare-story/$storyId" })
  const { skill, epicId } = useSearch({ from: "/prepare-story/$storyId" }) as PrepareStorySearch
  const navigate = useNavigate()
  const [data, setData] = useState<StoryPreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const config = SKILL_CONFIG[skill] ?? SKILL_CONFIG["bmad-create-story"]
  const storyLabel = parseStoryTicket(storyId)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const response = await fetch(`/api/story-preview/${encodeURIComponent(storyId)}`)
        if (!response.ok) {
          throw new Error(`preview request failed: ${response.status}`)
        }
        const payload = (await response.json()) as StoryPreviewResponse
        if (mounted) {
          setData(payload)
          setLoading(false)
        }
      } catch (loadError) {
        if (mounted) {
          setError(String(loadError))
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [storyId])

  const handleStart = useCallback(async () => {
    setStarting(true)
    setError(null)

    try {
      const response = await fetch("/api/workflow/run-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, storyId }),
      })

      if (response.status === HTTP_CONFLICT) {
        throw new Error(
          "Another workflow is already running. Wait for it to finish before starting a new one."
        )
      }

      if (!response.ok) {
        throw new Error(`workflow request failed: ${response.status}`)
      }

      const result = await response.json() as { sessionId?: string }
      if (result.sessionId) {
        void navigate({ to: "/session/$sessionId", params: { sessionId: result.sessionId } })
      } else {
        void navigate({ to: "/epic/$epicId", params: { epicId } })
      }
    } catch (startError) {
      setStarting(false)
      setError(String(startError))
    }
  }, [skill, storyId, epicId, navigate])

  const implementationHtml = useMemo(() => {
    if (!data?.implementation?.content) {
      return ""
    }
    return marked.parse(data.implementation.content, { async: false, gfm: true, breaks: false }) as string
  }, [data?.implementation?.content])

  if (loading) {
    return <main className="screen loading">Loading story preview...</main>
  }

  const contentSource = config.contentKey === "planning" ? data?.planning : data?.implementation

  return (
    <main className="screen">
      <section className="panel reveal">
        <div className="epic-header-top">
          <Link className="epic-back-link" to="/epic/$epicId" params={{ epicId }}>
            ← Back to Epic
          </Link>
        </div>
        <p className="eyebrow">{storyLabel}</p>
        <h1 className="epic-title">{config.heading}</h1>
        <p className="subtitle" style={{ marginTop: "0.5rem", maxWidth: "48rem" }}>
          {config.description}
        </p>
      </section>

      <section className="panel reveal delay-1" style={{ marginTop: "1rem" }}>
        {contentSource ? (
          <div style={{ padding: "0.5rem 0" }}>
            {config.contentKey === "planning" && data?.planning ? (
              <h2 style={{ color: "var(--text)", marginBottom: "1rem" }}>{data.planning.title}</h2>
            ) : config.contentKey === "implementation" && data?.implementation ? (
              <div style={{ marginBottom: "1rem" }}>
                <h2 style={{ color: "var(--text)", marginBottom: "0.25rem" }}>
                  Implementation Specification
                </h2>
                <span className="subtitle" style={{ fontSize: "0.8rem" }}>
                  {data.implementation.path}
                </span>
              </div>
            ) : null}
            <div
              style={{
                background: "rgba(2, 10, 16, 0.66)",
                border: "1px solid rgba(151, 177, 205, 0.22)",
                borderRadius: "8px",
                padding: "1.5rem",
              }}
            >
              {config.contentKey === "implementation" && data?.implementation ? (
                <div
                  className="md-rendered"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: content is from local markdown files
                  dangerouslySetInnerHTML={{ __html: implementationHtml }}
                />
              ) : data?.planning ? (
                renderMarkdownContent(data.planning.content)
              ) : null}
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center" }}>
            {config.emptyMessage}
          </p>
        )}
      </section>

      <section
        className="panel reveal delay-2"
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem",
          gap: "1rem",
        }}
      >
        <button
          className="cta"
          disabled={starting}
          onClick={() => void handleStart()}
          style={{
            fontSize: "1.1rem",
            padding: "0.9rem 2.5rem",
          }}
          type="button"
        >
          {starting ? "Starting..." : config.cta}
        </button>
        {error ? <p className="error-banner">{error}</p> : null}
      </section>
    </main>
  )
}

export const prepareStoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prepare-story/$storyId",
  component: PrepareStoryPage,
  validateSearch: (search: Record<string, unknown>): PrepareStorySearch => ({
    skill: (search.skill as PrepareStorySearch["skill"]) ?? "bmad-create-story",
    epicId: (search.epicId as string) ?? "",
  }),
})
