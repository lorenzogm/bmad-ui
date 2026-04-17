import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { type JSX, useState } from "react"
import { apiUrl, IS_LOCAL_MODE } from "../lib/mode"
import type { AnalyticsResponse, OverviewResponse } from "../types"
import { rootRoute } from "./__root"
import { formatNumber, formatUsd } from "./analytics-utils"

type LinkItem = { title: string; subtitle: string; url: string; icon: string }
type NoteItem = { id: string; text: string; color: string; createdAt: string }

const NOTE_COLORS = ["teal", "amber", "purple", "pink", "blue"] as const

const COST_PER_REQUEST_USD = 0.04

function HomePage() {
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
  } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/overview"))
      if (!response.ok) {
        throw new Error(`overview request failed: ${response.status}`)
      }
      return (await response.json()) as OverviewResponse
    },
  })

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/analytics"))
      if (!response.ok) {
        throw new Error(`analytics request failed: ${response.status}`)
      }
      return (await response.json()) as AnalyticsResponse
    },
  })

  if (overviewLoading || analyticsLoading) {
    return <main className="screen loading">Loading...</main>
  }

  if (overviewError || analyticsError) {
    return <main className="screen loading">{String(overviewError || analyticsError)}</main>
  }

  const epics = overview?.sprintOverview.epics ?? []
  const stories = overview?.sprintOverview.stories ?? []
  const sessions = analytics?.sessions ?? []
  const costing = analytics?.costing

  const epicsByStatus = countByStatus(epics, (e) => e.status)
  const storiesByStatus = countByStatus(stories, (s) => s.status)

  const runningSessions = sessions.filter((s) => s.status === "running").length
  const completedSessions = sessions.filter((s) => s.status === "completed").length
  const totalRequests = Math.round(costing?.totals.premiumRequests ?? 0)
  const totalTokens = costing?.totals.totalTokens ?? 0
  const estimatedCost =
    costing?.estimatedCostUsd.fromPremiumRequests ?? totalRequests * COST_PER_REQUEST_USD

  return (
    <main className="screen">
      {/* Executive Summary */}
      <section className="panel reveal">
        <p className="eyebrow">bmad-ui</p>
        <p className="mt-3" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          bmad-ui Phase 1 establishes the foundation for publishing bmad-ui as a professional,
          open-source project that complements the bmad orchestration platform. The goal is to
          implement GitHub repository management, Vercel deployment, CI/CD pipelines, dotenvx-based
          secret management, and a portable installation CLI so any bmad project can add bmad-ui
          with a single command.
        </p>
        <p className="mt-3" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          The differentiator is the integration of all components into a cohesive, professionally
          maintained system. bmad-ui's value multiplies when paired with bmad: bmad handles
          orchestration logic, bmad-ui provides visibility and control. Phase 1 is the prerequisite
          for Phase 2 (refactoring) and Phase 3 (guided product development features).
        </p>
      </section>

      {/* Links */}
      <LinksSection />

      {/* Notes */}
      <NotesSection />

      {/* Project Summary */}
      <section className="panel reveal delay-2">
        <p className="eyebrow">Project Summary</p>
        <h2>At a Glance</h2>

        <div
          className="mt-6 grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
        >
          {/* Epics Card */}
          <div className="panel" style={{ background: "rgba(2, 10, 16, 0.66)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Epics
              </h3>
              <Link
                to="/workflow/$phaseId"
                params={{ phaseId: "implementation" }}
                className="text-xs"
                style={{ color: "var(--highlight)" }}
              >
                View all →
              </Link>
            </div>
            <p className="text-3xl font-bold mb-4" style={{ color: "var(--text)" }}>
              {epics.length}
            </p>
            <StatusBreakdown
              items={[
                { label: "Done", count: epicsByStatus.done ?? 0, color: "var(--status-done)" },
                {
                  label: "In Progress",
                  count: epicsByStatus["in-progress"] ?? 0,
                  color: "var(--status-progress)",
                },
                {
                  label: "Backlog",
                  count: epicsByStatus.backlog ?? 0,
                  color: "var(--status-ready)",
                },
                {
                  label: "Planned",
                  count: epicsByStatus.planned ?? 0,
                  color: "var(--status-backlog)",
                },
              ]}
              total={epics.length}
            />
          </div>

          {/* Stories Card */}
          <div className="panel" style={{ background: "rgba(2, 10, 16, 0.66)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Stories
              </h3>
            </div>
            <p className="text-3xl font-bold mb-4" style={{ color: "var(--text)" }}>
              {stories.length}
            </p>
            <StatusBreakdown
              items={[
                { label: "Done", count: storiesByStatus.done ?? 0, color: "var(--status-done)" },
                {
                  label: "In Progress",
                  count: storiesByStatus["in-progress"] ?? 0,
                  color: "var(--status-progress)",
                },
                {
                  label: "Review",
                  count: storiesByStatus.review ?? 0,
                  color: "var(--highlight-2)",
                },
                {
                  label: "Ready",
                  count: storiesByStatus["ready-for-dev"] ?? 0,
                  color: "var(--status-ready)",
                },
                {
                  label: "Backlog",
                  count: storiesByStatus.backlog ?? 0,
                  color: "var(--status-backlog)",
                },
              ]}
              total={stories.length}
            />
          </div>

          {/* Sessions Card */}
          <div className="panel" style={{ background: "rgba(2, 10, 16, 0.66)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Agent Sessions
              </h3>
              <Link to="/sessions" className="text-xs" style={{ color: "var(--highlight)" }}>
                View all →
              </Link>
            </div>
            <p className="text-3xl font-bold mb-4" style={{ color: "var(--text)" }}>
              {sessions.length}
            </p>
            <div className="flex flex-col gap-2">
              <StatusRow label="Running" count={runningSessions} color="var(--status-progress)" />
              <StatusRow label="Completed" count={completedSessions} color="var(--status-done)" />
            </div>
          </div>

          {/* Cost Card */}
          <div className="panel" style={{ background: "rgba(2, 10, 16, 0.66)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Cost
              </h3>
              <Link to="/analytics" className="text-xs" style={{ color: "var(--highlight)" }}>
                View details →
              </Link>
            </div>
            <p className="text-3xl font-bold mb-4" style={{ color: "var(--highlight)" }}>
              {formatUsd(estimatedCost)}
            </p>
            <div className="flex flex-col gap-2">
              <StatusRow label="Premium Requests" count={totalRequests} color="var(--muted)" />
              <StatusRow
                label="Total Tokens"
                count={totalTokens}
                color="var(--muted)"
                formatValue
              />
            </div>
          </div>
        </div>
      </section>

      {/* Epic Progress Detail */}
      <section className="panel reveal delay-3">
        <p className="eyebrow">Epic Breakdown</p>
        <h2>Progress by Epic</h2>
        <div className="mt-4 flex flex-col gap-3">
          {[...epics]
            .sort((a, b) => a.number - b.number)
            .map((epic) => {
              const done = epic.byStoryStatus?.done ?? 0
              const total = epic.storyCount
              const pct = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <Link
                  key={epic.id}
                  to="/epic/$epicId"
                  params={{ epicId: epic.id }}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg"
                  style={{
                    background: "rgba(2, 10, 16, 0.66)",
                    border: "1px solid rgba(151, 177, 205, 0.12)",
                  }}
                >
                  <span
                    className="text-sm font-mono font-bold shrink-0 w-8 text-center"
                    style={{ color: "var(--highlight)" }}
                  >
                    {epic.number}
                  </span>
                  <span className="flex-1 text-sm truncate" style={{ color: "var(--text)" }}>
                    {epic.name}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                    {done}/{total} stories
                  </span>
                  <div
                    className="shrink-0 rounded-full overflow-hidden"
                    style={{
                      width: 80,
                      height: 6,
                      background: "rgba(151, 177, 205, 0.15)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "var(--status-done)" : "var(--highlight)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span className={`step-badge step-${epic.status}`}>{epic.status}</span>
                </Link>
              )
            })}
        </div>
      </section>
    </main>
  )
}

const LINK_ICON_MAP: Record<string, JSX.Element> = {
  github: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: "var(--highlight)", flexShrink: 0 }}
    >
      <title>GitHub</title>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  book: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--highlight)", flexShrink: 0 }}
    >
      <title>Book</title>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  link: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--highlight)", flexShrink: 0 }}
    >
      <title>Link</title>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
}

function LinksSection() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [url, setUrl] = useState("")

  const { data } = useQuery<{ links: LinkItem[] }>({
    queryKey: ["links"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/links"))
      if (!res.ok) throw new Error("failed to load links")
      return (await res.json()) as { links: LinkItem[] }
    },
  })

  const addLink = useMutation({
    mutationFn: async (link: { title: string; subtitle: string; url: string; icon: string }) => {
      const res = await fetch(apiUrl("/api/links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      })
      if (!res.ok) throw new Error("failed to add link")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] })
      setShowForm(false)
      setTitle("")
      setSubtitle("")
      setUrl("")
    },
  })

  const deleteLink = useMutation({
    mutationFn: async (index: number) => {
      const res = await fetch(apiUrl(`/api/links?index=${index}`), { method: "DELETE" })
      if (!res.ok) throw new Error("failed to delete link")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] })
    },
  })

  const links = data?.links ?? []

  return (
    <section className="panel reveal delay-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Links</p>
          <h2>Useful Resources</h2>
        </div>
      </div>
      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
      >
        {links.map((link, i) => (
          <div key={`${link.url}-${link.title}`} className="relative group">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{
                background: "rgba(2, 10, 16, 0.66)",
                border: "1px solid rgba(151, 177, 205, 0.12)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {LINK_ICON_MAP[link.icon] ?? LINK_ICON_MAP.link}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {link.title}
                </span>
                {link.subtitle && (
                  <span className="text-xs truncate" style={{ color: "var(--muted)" }}>
                    {link.subtitle}
                  </span>
                )}
              </div>
            </a>
            {IS_LOCAL_MODE && (
              <button
                type="button"
                className="icon-button icon-button-delete absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteLink.mutate(i)}
                title="Remove link"
              >
                <span className="icon-glyph">×</span>
              </button>
            )}
          </div>
        ))}
        {/* Add link button */}
        {IS_LOCAL_MODE && (
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer"
            style={{
              background: "rgba(2, 10, 16, 0.33)",
              border: "1px dashed rgba(151, 177, 205, 0.22)",
              color: "var(--muted)",
            }}
            onClick={() => setShowForm(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Add</title>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-sm">Add link</span>
          </button>
        )}
      </div>
      {showForm && (
        <form
          className="mt-4 flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (title && url) addLink.mutate({ title, subtitle, url, icon: "link" })
          }}
        >
          <input
            className="rounded px-3 py-2 text-sm flex-1 min-w-[140px]"
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              color: "var(--text)",
            }}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded px-3 py-2 text-sm flex-1 min-w-[140px]"
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              color: "var(--text)",
            }}
            placeholder="Subtitle (optional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <input
            className="rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              color: "var(--text)",
            }}
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="cta text-sm px-4 py-2">
            Add
          </button>
          <button
            type="button"
            className="ghost text-sm px-4 py-2"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  )
}

const NOTE_COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  teal: {
    bg: "rgba(46, 196, 182, 0.12)",
    border: "rgba(46, 196, 182, 0.3)",
    text: "var(--highlight)",
  },
  amber: {
    bg: "rgba(255, 159, 28, 0.12)",
    border: "rgba(255, 159, 28, 0.3)",
    text: "var(--highlight-2)",
  },
  purple: { bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.3)", text: "#a855f7" },
  pink: { bg: "rgba(236, 72, 153, 0.12)", border: "rgba(236, 72, 153, 0.3)", text: "#ec4899" },
  blue: { bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.3)", text: "#3b82f6" },
}

function renderNoteText(text: string): JSX.Element {
  const lines = text.split("\n")
  const elements: JSX.Element[] = []
  let bulletBuffer: string[] = []

  function flushBullets() {
    if (bulletBuffer.length === 0) return
    elements.push(
      <ul
        key={`ul-${elements.length}`}
        className="list-disc list-inside my-1"
        style={{ color: "var(--text)" }}
      >
        {bulletBuffer.map((b) => (
          <li key={b} className="text-sm" style={{ lineHeight: 1.6 }}>
            {b}
          </li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/)
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1])
    } else {
      flushBullets()
      elements.push(
        <span
          key={`t-${elements.length}`}
          className="block text-sm"
          style={{
            color: "var(--text)",
            lineHeight: 1.6,
            minHeight: line.trim() ? undefined : "0.5em",
          }}
        >
          {line}
        </span>
      )
    }
  }
  flushBullets()

  return <>{elements}</>
}

function NotesSection() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState("")
  const [color, setColor] = useState<string>("teal")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editColor, setEditColor] = useState<string>("teal")

  const { data } = useQuery<{ notes: NoteItem[] }>({
    queryKey: ["notes"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/notes"))
      if (!res.ok) throw new Error("failed to load notes")
      return (await res.json()) as { notes: NoteItem[] }
    },
  })

  const addNote = useMutation({
    mutationFn: async (note: { text: string; color: string }) => {
      const res = await fetch(apiUrl("/api/notes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      })
      if (!res.ok) throw new Error("failed to add note")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      setShowForm(false)
      setText("")
      setColor("teal")
    },
  })

  const editNote = useMutation({
    mutationFn: async (note: { id: string; text: string; color: string }) => {
      const res = await fetch(apiUrl("/api/notes"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      })
      if (!res.ok) throw new Error("failed to edit note")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      setEditingId(null)
    },
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/api/notes?id=${id}`), { method: "DELETE" })
      if (!res.ok) throw new Error("failed to delete note")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })

  const notes = data?.notes ?? []

  return (
    <section className="panel reveal delay-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Notes</p>
          <h2>Post-it Board</h2>
        </div>
        {IS_LOCAL_MODE && (
          <button
            type="button"
            className="ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
            onClick={() => setShowForm(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Add</title>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add note
          </button>
        )}
      </div>
      {showForm && (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) addNote.mutate({ text: text.trim(), color })
          }}
        >
          <textarea
            className="rounded px-3 py-2 text-sm resize-none"
            style={{
              background: "rgba(2, 10, 16, 0.66)",
              border: "1px solid rgba(151, 177, 205, 0.22)",
              color: "var(--text)",
              minHeight: 80,
            }}
            placeholder="Write a note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Color:
            </span>
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: NOTE_COLOR_MAP[c]?.border ?? "var(--muted)",
                  border: c === color ? "2px solid var(--text)" : "2px solid transparent",
                  cursor: "pointer",
                }}
                onClick={() => setColor(c)}
              />
            ))}
            <div className="flex-1" />
            <button type="submit" className="cta text-sm px-4 py-2">
              Add
            </button>
            <button
              type="button"
              className="ghost text-sm px-4 py-2"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {notes.length > 0 && (
        <div
          className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
        >
          {notes.map((note) => {
            const colors = NOTE_COLOR_MAP[note.color] ?? NOTE_COLOR_MAP.teal
            const isEditing = editingId === note.id
            return (
              <div
                key={note.id}
                className="relative group rounded-lg px-4 py-3"
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  minHeight: 100,
                }}
              >
                {isEditing ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (editText.trim())
                        editNote.mutate({ id: note.id, text: editText.trim(), color: editColor })
                    }}
                  >
                    <textarea
                      className="rounded px-2 py-1.5 text-sm resize-none w-full"
                      style={{
                        background: "rgba(2, 10, 16, 0.66)",
                        border: "1px solid rgba(151, 177, 205, 0.22)",
                        color: "var(--text)",
                        minHeight: 80,
                      }}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            background: NOTE_COLOR_MAP[c]?.border ?? "var(--muted)",
                            border:
                              c === editColor ? "2px solid var(--text)" : "2px solid transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                      <div className="flex-1" />
                      <button type="submit" className="cta text-xs px-3 py-1">
                        Save
                      </button>
                      <button
                        type="button"
                        className="ghost text-xs px-3 py-1"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>{renderNoteText(note.text)}</div>
                    <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                  </>
                )}
                {!isEditing && IS_LOCAL_MODE && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      type="button"
                      className="icon-button icon-button-play"
                      onClick={() => {
                        setEditingId(note.id)
                        setEditText(note.text)
                        setEditColor(note.color)
                      }}
                      title="Edit note"
                    >
                      <span className="icon-glyph">✎</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button-delete"
                      onClick={() => deleteNote.mutate(note.id)}
                      title="Delete note"
                    >
                      <span className="icon-glyph">×</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {notes.length === 0 && !showForm && (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          No notes yet. Add one to get started.
        </p>
      )}
    </section>
  )
}

function StatusBreakdown({
  items,
  total,
}: {
  items: Array<{ label: string; count: number; color: string }>
  total: number
}) {
  const nonZero = items.filter((i) => i.count > 0)

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar */}
      {total > 0 && (
        <div
          className="flex rounded-full overflow-hidden"
          style={{ height: 6, background: "rgba(151, 177, 205, 0.15)" }}
        >
          {nonZero.map((item) => (
            <div
              key={item.label}
              style={{
                width: `${(item.count / total) * 100}%`,
                background: item.color,
                minWidth: item.count > 0 ? 4 : 0,
              }}
            />
          ))}
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items
          .filter((i) => i.count > 0)
          .map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: item.color }}
              />
              <span style={{ color: "var(--muted)" }}>
                {item.label}: <strong style={{ color: "var(--text)" }}>{item.count}</strong>
              </span>
            </span>
          ))}
      </div>
    </div>
  )
}

function StatusRow({
  label,
  count,
  color,
  formatValue,
}: {
  label: string
  count: number
  color: string
  formatValue?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: color }}
        />
        <span style={{ color: "var(--muted)" }}>{label}</span>
      </span>
      <span className="font-mono font-semibold" style={{ color: "var(--text)" }}>
        {formatValue ? formatNumber(count) : count}
      </span>
    </div>
  )
}

function countByStatus<T, S extends string>(
  items: T[],
  getStatus: (item: T) => S
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    const status = getStatus(item)
    result[status] = (result[status] ?? 0) + 1
  }
  return result
}

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})
