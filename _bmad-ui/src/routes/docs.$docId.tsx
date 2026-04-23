import { useQuery } from "@tanstack/react-query"
import { createRoute, Link, useParams } from "@tanstack/react-router"
import { marked } from "marked"
import type { DocDetailResponse } from "../lib/docs-catalog"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import { rootRoute } from "./__root"

function DocDetailPage() {
  const { docId } = useParams({ from: "/docs/$docId" as const })

  const { data, isLoading, error, refetch } = useQuery<DocDetailResponse>({
    queryKey: ["doc-content", docId],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/docs/${encodeURIComponent(docId)}`))
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`)
      }
      return (await response.json()) as DocDetailResponse
    },
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    const isNotFound = String(error).includes("404")
    if (isNotFound) {
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
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  const doc = data?.doc
  const htmlContent = data?.content ? String(marked.parse(data.content)) : ""

  return (
    <main className="screen">
      <section className="panel reveal" style={{ padding: "2rem 2.5rem" }}>
        <Link className="epic-back-link" to="/docs">
          ← Back to Docs
        </Link>
        <p className="eyebrow mt-4">Documentation</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          {doc?.name ?? docId}
        </h1>
        {doc?.path ? (
          <p className="mb-6 text-xs text-(--muted) opacity-60 font-mono">{doc.path}</p>
        ) : null}
        <div
          className="doc-prose"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering trusted local markdown files
          dangerouslySetInnerHTML={{ __html: htmlContent }}
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
