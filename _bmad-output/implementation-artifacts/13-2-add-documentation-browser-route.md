# Story 13.2: Documentation Browser — File Explorer + Detail Page

Status: ready-for-dev

## Story

As a user,
I want `/docs` to mirror the actual `docs/` folder as a file-explorer list and clicking any document to open a readable detail page,
so that I can browse and read project documentation in both local and production environments.

## Acceptance Criteria

1. **Given** navigating to `/docs`, **When** the page loads, **Then** a vertical list of documents is shown, sorted alphabetically by name, top to bottom — mirroring the files in the repository's `docs/` folder.

2. **Given** the docs list, **When** the `docs/` folder contains nested subdirectories, **Then** each folder is displayed as a collapsible section with its children listed inside, sorted by name.

3. **Given** the docs list, **When** any document entry is clicked, **Then** the user is navigated to `/docs/$docId` where the markdown content is rendered as readable prose.

4. **Given** navigating to `/docs/$docId`, **When** the page loads in either local or production mode, **Then** the markdown content renders correctly — headings, code blocks, lists, and links — using the `marked` library.

5. **Given** the docs list and detail pages, **When** rendered, **Then** no emoji characters appear anywhere in the UI (no icon prefixes on file names or folder names).

6. **Given** navigating to `/docs`, **When** the page loads, **Then** the sidebar "Documentation" link shows as active.

7. **Given** navigating to `/docs/$docId`, **When** the page loads, **Then** the sidebar "Documentation" link shows as active, and a "Back to Docs" link returns the user to `/docs`.

8. **Given** the production build, **When** `/docs` and `/docs/$docId` are visited, **Then** the pages load correctly with real content — the docs list and markdown rendering are not gated behind `IS_LOCAL_MODE`.

## Tasks / Subtasks

- [ ] **Server API — new file `scripts/server/routes/docs.ts`** (AC: 1, 2, 8)
  - [ ] `GET /api/docs` — walk the `docs/` folder recursively, return `{ entries: DocEntry[] }` tree sorted alphabetically; files only (no `.json` files); `DocEntry = { name: string, docId: string, type: 'file' | 'folder', children?: DocEntry[] }`
  - [ ] `GET /api/docs/content/:docId` — read the file at the path decoded from `docId`, return `{ content: string }`; return 404 if not found
  - [ ] Register `handleDocsRoutes` in `scripts/server/routes/index.ts` (before the 404 fallback)
  - [ ] `docId` encoding: replace `/` with `~` in the path, e.g. `deployment-guide.md` → `deployment-guide.md`, `subfolder/file.md` → `subfolder~file.md`

- [ ] **Static build — update `scripts/vite-plugin-static-data.ts`** (AC: 8)
  - [ ] Emit `data/docs.json` — same tree structure as `/api/docs`
  - [ ] For each `.md` file in `docs/` emit `data/docs/content/[docId].json` with `{ content: string }` (read the actual markdown)

- [ ] **`src/lib/docs-catalog.ts` — replace hardcoded list with shared types** (AC: 1, 2, 3)
  - [ ] Remove `KNOWN_DOCS` constant entirely
  - [ ] Export `type DocEntry` matching server shape: `{ name: string, docId: string, type: 'file' | 'folder', children?: DocEntry[] }`
  - [ ] Export `docIdToPath(docId: string): string` — replaces `~` with `/`
  - [ ] Export `docPathToId(path: string): string` — replaces `/` with `~`
  - [ ] No default exports

- [ ] **`src/routes/docs.tsx` — file-explorer list** (AC: 1, 2, 5, 6)
  - [ ] Use `useQuery` to fetch `apiUrl('/api/docs')` → `{ entries: DocEntry[] }`
  - [ ] Render as vertical list (not card grid): one item per row, files listed A–Z, folders rendered as labeled sections with children indented
  - [ ] Each file row: `<Link to="/docs/$docId" params={{ docId: entry.docId }}>` showing `entry.name` — no emojis, no icons
  - [ ] Folder sections: render folder name as a label (not a link), children indented below
  - [ ] Show `PageSkeleton` while loading, `QueryErrorState` on error
  - [ ] No `IS_LOCAL_MODE` gating — list is always shown

- [ ] **`src/routes/docs.$docId.tsx` — markdown detail page** (AC: 3, 4, 5, 7, 8)
  - [ ] Use `useQuery` to fetch `apiUrl('/api/docs/content/' + docId)` → `{ content: string }`
  - [ ] Render content with `marked.parse(content)` inside `dangerouslySetInnerHTML`
  - [ ] Use `.story-markdown` CSS class for rendered output (already defined in `styles.css`)
  - [ ] Remove the `IS_LOCAL_MODE` gate — content renders in both modes
  - [ ] Remove the old "only available in local mode" message
  - [ ] Show `PageSkeleton` while loading, `QueryErrorState` on error
  - [ ] "Back to Docs" link navigates to `/docs`

- [ ] **Tests — `tests/docs.spec.ts`** (AC: 1, 2, 3, 4, 5, 8)
  - [ ] Mock `GET /api/docs` with a fixture containing all current `/docs/*.md` files plus one nested folder
  - [ ] Mock `GET /api/docs/content/:docId` with a sample markdown fixture
  - [ ] Test: `/docs` loads without JS errors and renders the expected file names from the fixture
  - [ ] Test: clicking a file row navigates to `/docs/$docId`
  - [ ] Test: `/docs/$docId` loads without JS errors and renders markdown HTML content
  - [ ] Test: no emoji characters appear on `/docs` or `/docs/$docId`
  - [ ] Test: nested folder section heading appears and its children are listed

- [ ] **`pnpm check` passes** — run from `_bmad-ui/`

## Dev Notes

### Architecture pattern — dual-mode API

This story follows the established dual-mode pattern in `src/lib/mode.ts`:

```ts
// In local dev: resolved to Vite middleware
apiUrl('/api/docs')  →  '/api/docs'
apiUrl('/api/docs/content/deployment-guide.md')  →  '/api/docs/content/deployment-guide.md'

// In production: resolved to static JSON
apiUrl('/api/docs')  →  '/data/docs.json'
apiUrl('/api/docs/content/deployment-guide.md')  →  '/data/docs/content/deployment-guide.md.json'
```

The existing `apiUrl` implementation strips `/api/` and appends `.json` — this works **automatically** for the docs endpoints without any changes to `mode.ts`.

### `docId` encoding

The `docId` URL param must be safe for use in TanStack Router's `$docId` dynamic segment. Since TanStack Router's `$docId` does not handle `/` in paths, encode the docs path by replacing `/` with `~`:

```ts
export function docPathToId(path: string): string {
  return path.replace(/\//g, '~')
}

export function docIdToPath(docId: string): string {
  return docId.replace(/~/g, '/')
}
```

Example mappings:
- `deployment-guide.md` → docId `deployment-guide.md` → URL `/docs/deployment-guide.md`
- `subfolder/guide.md` → docId `subfolder~guide.md` → URL `/docs/subfolder~guide.md`

### Server route — docs.ts skeleton

```ts
// scripts/server/routes/docs.ts
import { readdirSync, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { projectRoot } from '../paths.js'

const DOCS_DIR_PATH_REGEX = /^\/api\/docs$/
const DOCS_CONTENT_PATH_REGEX = /^\/api\/docs\/content\/(.+)$/

const docsRoot = path.join(projectRoot, 'docs')

function buildDocTree(dir: string, baseDir: string): DocEntry[] { ... }

export async function handleDocsRoutes(requestUrl, req, res): Promise<boolean> { ... }
```

### Static build — docs emission in vite-plugin-static-data.ts

Add after the existing `emit('links.json', ...)` block:

```ts
// Docs tree
const docsTree = buildDocTree(docsRoot)
emit('docs.json', { entries: docsTree })

// Individual doc content
for (const entry of flattenDocTree(docsTree)) {
  const filePath = path.join(docsRoot, docIdToPath(entry.docId))
  const content = await readFile(filePath, 'utf8')
  emit(`docs/content/${entry.docId}.json`, { content })
}
```

### File structure

Files to create:
- `_bmad-ui/scripts/server/routes/docs.ts` — new server route handler
- `_bmad-ui/tests/docs.spec.ts` — new Playwright test
- `_bmad-ui/tests/fixtures/docs-list.json` — docs tree fixture
- `_bmad-ui/tests/fixtures/doc-content.json` — single doc content fixture `{ content: "# Title\n..." }`

Files to modify:
- `_bmad-ui/src/lib/docs-catalog.ts` — remove KNOWN_DOCS, export types + helpers
- `_bmad-ui/src/routes/docs.tsx` — replace grid with file-explorer list
- `_bmad-ui/src/routes/docs.$docId.tsx` — remove IS_LOCAL_MODE gate, add content fetch
- `_bmad-ui/scripts/server/routes/index.ts` — register handleDocsRoutes
- `_bmad-ui/scripts/vite-plugin-static-data.ts` — emit docs.json + per-doc content JSON

### Current docs/ folder (as of story creation)

All `.md` files are flat (no subdirectories). Files to mirror:
```
docs/adoption-signals.md
docs/api-contracts-bmad-ui.md
docs/architecture-bmad-orchestrator.md
docs/architecture-bmad-ui.md
docs/component-inventory-bmad-ui.md
docs/data-models-bmad-ui.md
docs/deployment-guide.md
docs/development-guide-bmad-orchestrator.md
docs/development-guide-bmad-ui.md
docs/index.md
docs/integration-architecture.md
docs/phase-1-completion.md
docs/project-overview.md
docs/secret-rotation.md
docs/secrets-workflow.md
docs/source-tree-analysis.md
docs/troubleshooting.md
```

Non-markdown files (`project-parts.json`, `project-scan-report.json`) must be excluded from the list — only `.md` files are shown.

### Existing code to reuse / not reinvent

- `marked` (v18.0.0) is already imported in `docs.$docId.tsx` — keep using it
- `.story-markdown` CSS class in `styles.css` is already defined with proper dark theme, monospace font, padding — use it for rendered markdown
- `PageSkeleton` and `QueryErrorState` from `@/lib/loading-states` — use for loading/error states
- `apiUrl` from `@/lib/mode` — always wrap fetch URLs with this

### Project Context rules (must follow)

- Named function components (not arrow function consts)
- `import type { ... }` for type-only imports
- No `useEffect` for data fetching — use `useQuery` only
- `Number.parseInt()` etc. (not global `parseInt`)
- Magic numbers as named `const` at top of file
- No default exports
- Use `@/*` alias for imports from `src/` — no relative `../../` traversals across features

### Testing note

The `tests/docs.spec.ts` test file must mock the API routes using the established `mockApi` helper from `tests/helpers/mock-api.ts`. Do not make real filesystem calls from tests. The fixture `docs-list.json` should include all 17 current `.md` files listed above, plus one nested folder entry to validate nested folder rendering.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
