import { createRoute, Link } from "@tanstack/react-router"
import type { DocEntry } from "../lib/docs-catalog"
import { KNOWN_DOCS } from "../lib/docs-catalog"
import { rootRoute } from "./__root"

function DocCard(props: { doc: DocEntry }) {
  const { doc } = props
  return (
    <Link
      className="panel"
      params={{ docId: doc.id }}
      style={{
        display: "block",
        padding: "1.25rem 1.5rem",
        textDecoration: "none",
        color: "var(--text)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.5rem",
        transition: "border-color 0.15s",
      }}
      to="/docs/$docId"
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--highlight)",
          marginBottom: "0.25rem",
        }}
      >
        {doc.name}
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{doc.description}</div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginTop: "0.5rem",
          opacity: 0.7,
        }}
      >
        {doc.path}
      </div>
    </Link>
  )
}

function DocsPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <p className="eyebrow">Documentation</p>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "0.5rem",
        }}
      >
        Project Docs
      </h2>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Browse key documentation files for the BMAD UI project.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {KNOWN_DOCS.map((doc) => (
          <DocCard doc={doc} key={doc.path} />
        ))}
      </div>
    </div>
  )
}

export const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsPage,
})
