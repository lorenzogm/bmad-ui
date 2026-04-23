import { useQuery } from "@tanstack/react-query"
import { createRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import type { DocsListResponse, DocTreeNode } from "../lib/docs-catalog"
import { PageSkeleton, QueryErrorState } from "../lib/loading-states"
import { apiUrl } from "../lib/mode"
import { rootRoute } from "./__root"

const ICON_SIZE = "1rem"
const INDENT_PX = 20

function FileIcon() {
  return (
    <svg
      fill="none"
      height={ICON_SIZE}
      stroke="var(--muted)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width={ICON_SIZE}
    >
      <title>File</title>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function FolderIcon(props: { open: boolean }) {
  if (props.open) {
    return (
      <svg
        fill="none"
        height={ICON_SIZE}
        stroke="var(--highlight)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width={ICON_SIZE}
      >
        <title>Open folder</title>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    )
  }
  return (
    <svg
      fill="none"
      height={ICON_SIZE}
      stroke="var(--highlight)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width={ICON_SIZE}
    >
      <title>Folder</title>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ChevronIcon(props: { open: boolean }) {
  return (
    <svg
      fill="none"
      height="14"
      stroke="var(--muted)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{
        transition: "transform 0.15s",
        transform: props.open ? "rotate(90deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
      viewBox="0 0 24 24"
      width="14"
    >
      <title>Toggle</title>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function TreeFile(props: { node: DocTreeNode; depth: number }) {
  const { node, depth } = props
  if (!node.doc) return null

  return (
    <Link
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors hover:bg-[rgba(46,196,182,0.08)]"
      params={{ docId: node.doc.id }}
      style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
      to="/docs/$docId"
    >
      <FileIcon />
      <span className="truncate text-(--text) group-hover:text-(--highlight)">{node.name}</span>
      {node.doc.description ? (
        <span className="ml-auto hidden truncate pl-4 text-xs text-(--muted) opacity-70 lg:inline">
          {node.doc.description}
        </span>
      ) : null}
    </Link>
  )
}

function TreeFolder(props: { node: DocTreeNode; depth: number }) {
  const { node, depth } = props
  const [open, setOpen] = useState(true)
  const children = node.children ?? []
  const fileCount = children.filter((c) => c.type === "file").length
  const folderCount = children.filter((c) => c.type === "folder").length

  return (
    <div>
      <button
        className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-sm text-(--text) transition-colors hover:bg-[rgba(46,196,182,0.08)]"
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
        type="button"
      >
        <ChevronIcon open={open} />
        <FolderIcon open={open} />
        <span className="font-medium">{node.name}</span>
        <span className="ml-1 text-xs text-(--muted) opacity-60">
          {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : ""}
          {folderCount > 0 ? ` · ${folderCount} folder${folderCount !== 1 ? "s" : ""}` : ""}
        </span>
      </button>
      {open ? (
        <div>
          {children.map((child) => (
            <TreeNode depth={depth + 1} key={child.name} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TreeNode(props: { node: DocTreeNode; depth: number }) {
  const { node, depth } = props
  if (node.type === "folder") {
    return <TreeFolder depth={depth} node={node} />
  }
  return <TreeFile depth={depth} node={node} />
}

function DocsPage() {
  const { data, isLoading, error, refetch } = useQuery<DocsListResponse>({
    queryKey: ["docs-list"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/docs"))
      if (!response.ok) {
        throw new Error(`docs request failed: ${response.status}`)
      }
      return (await response.json()) as DocsListResponse
    },
  })

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error) {
    return <QueryErrorState message={String(error)} onRetry={refetch} />
  }

  const tree = data?.tree ?? []
  const totalDocs = data?.docs?.length ?? 0

  return (
    <div className="p-8">
      <p className="eyebrow">Documentation</p>
      <h2 className="mb-1 text-2xl font-bold text-(--text)">Project Docs</h2>
      <p className="mb-6 text-(--muted)">
        {totalDocs} document{totalDocs !== 1 ? "s" : ""} across the project
      </p>

      <div className="panel rounded-lg border border-(--panel-border) p-2">
        <div className="mb-2 flex items-center gap-2 border-b border-[rgba(151,177,205,0.15)] px-2 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-(--muted)">
            Explorer
          </span>
        </div>
        <nav>
          {tree.map((node) => (
            <TreeNode depth={0} key={node.name} node={node} />
          ))}
        </nav>
      </div>
    </div>
  )
}

export const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsPage,
})
