export type DocEntry = {
  id: string
  name: string
  path: string
  description: string
}

export type DocTreeNode = {
  name: string
  type: "file" | "folder"
  doc?: DocEntry
  children?: DocTreeNode[]
}

export type DocsListResponse = {
  docs: DocEntry[]
  tree: DocTreeNode[]
}

export type DocDetailResponse = {
  doc: DocEntry
  content: string
}
