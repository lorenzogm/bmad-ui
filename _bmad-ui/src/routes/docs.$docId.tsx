import { useQuery } from "@tanstack/react-query"
import { createRoute, Link, useParams } from "@tanstack/react-router"
import { marked } from "marked"
import { KNOWN_DOCS } from "../lib/docs-catalog"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { IS_LOCAL_MODE } from "../lib/mode"
import { rootRoute } from "./__root"

function DocDetailPage() {
  const { docId } = useParams({ from: "/docs/$docId" as const })

  const doc = KNOWN_DOCS.find((d) => d.id === docId)

  const {
    data: content,
    isLoading,
    error,
    refetch,
  } = useQuery<string>({
    queryKey: ["doc-content", docId],
    enabled: !!doc && IS_LOCAL_MODE,
    queryFn: async () => {
      if (!doc) throw new Error("Unknown document")
      const response = await fetch(doc.path)
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`)
      }
      return response.text()
    },
  })

  if (!doc) {
    return (
      <main className="screen">
        <section className="panel reveal">
          <Link className="epic-back-link" to="/docs">
            ← Back to Docs
          </Link>
          <h1 className="text-2xl font-bold mt-4 mb-2" style={{ color: "var(--text)" }}>
            Document not found
          </h1>
          <p className="subtitle">No document matches the ID: {docId}</p>
        </section>
      </main>
    )
  }

  if (!IS_LOCAL_MODE) {
    return (
      <main className="screen">
        <section className="panel reveal">
          <Link className="epic-back-link" to="/docs">
            ← Back to Docs
          </Link>
          <p className="eyebrow mt-4">Documentation</p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
            {doc.name}
          </h1>
          <p className="subtitle">
            Inline document rendering is only available in local development mode.
          </p>
        </section>
      </main>
    )
  }

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  const htmlContent = content ? String(marked.parse(content)) : ""

  return (
    <main className="screen">
      <section className="panel reveal">
        <Link className="epic-back-link" to="/docs">
          ← Back to Docs
        </Link>
        <p className="eyebrow mt-4">Documentation</p>
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text)" }}>
          {doc.name}
        </h1>
        <div
          className="prose"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering trusted local markdown files
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{ color: "var(--text)", maxWidth: "72ch", lineHeight: 1.75 }}
        />
      </section>
    </main>
  )
}

export const docDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$docId",
  component: DocDetailPage,
})
