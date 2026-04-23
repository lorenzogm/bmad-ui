export type DocEntry = {
  id: string
  name: string
  path: string
  description: string
}

export type DocsListResponse = {
  docs: DocEntry[]
}

export type DocDetailResponse = {
  doc: DocEntry
  content: string
}
