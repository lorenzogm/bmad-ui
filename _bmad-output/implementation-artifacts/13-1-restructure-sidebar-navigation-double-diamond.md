# Story 13.1: Redesign Sidebar Navigation — 5-Section Consolidated Layout

Status: ready-for-dev

## Story

As a user,
I want the sidebar navigation to have 5 clean top-level sections (Home, Discover & Define, Develop & Deliver, Documentation, Agents),
so that I can navigate the app intuitively without the current fragmentation across 6 separate Diamond sections.

## Acceptance Criteria

1. **Given** the sidebar, **When** viewed, **Then** it shows exactly 5 items: Home, Discover & Define, Develop & Deliver, Documentation, Agents.

2. **Given** the Home link, **When** clicked, **Then** it navigates to `/` which renders the existing home page (links, notes, project summary).

3. **Given** the "Discover & Define" link, **When** clicked, **Then** it navigates to `/discover-define` which renders a single page with one accordion containing 3 collapsible phases: Analysis, Planning, and Solutioning — each phase shows the content from its corresponding workflow phase.

4. **Given** the "Develop & Deliver" link, **When** clicked, **Then** it navigates to `/develop-deliver` which renders a single page with sprint planning status (active epic, story counts) and the full epics list with progress bars.

5. **Given** the "Documentation" link, **When** clicked, **Then** it navigates to `/docs` which renders a listing page of all docs (grid of cards); each card links to `/docs/$docId` (not opens external URL).

6. **Given** a doc card click, **When** on `/docs/$docId`, **Then** the markdown file content is fetched and rendered inline using `marked` (no external browser tab opened).

7. **Given** the "Agents" link, **When** clicked, **Then** it navigates to `/agents` which shows the agent catalog, AND the sidebar shows a submenu with: Sessions, Analytics, Epics links.

8. **Given** any active route, **When** the sidebar is rendered, **Then** the correct section item shows the `is-section-active` CSS class.

9. **Given** all existing routes (workflow phases, sessions, analytics, etc.), **When** navigated to directly via URL, **Then** they continue to work unchanged (no regressions).

## Tasks / Subtasks

- [ ] Create `src/routes/discover-define.tsx` — single page with accordion (3 phases) (AC: 3)
  - [ ] Accordion built with `<details>/<summary>` HTML or `useState` expand/collapse (no shadcn — Phase 1)
  - [ ] Phase content: embed/re-export view from existing `workflow.$phaseId.tsx` or inline equivalent content
- [ ] Create `src/routes/develop-deliver.tsx` — page with sprint planning + epics (AC: 4)
  - [ ] Sprint planning panel: active epic, in-progress stories count, running sessions count (reuse `ActiveSprintSummary` from `home.tsx` or extract to shared component)
  - [ ] Epics panel: full epics list with story progress bars (reuse epics display logic from `home.tsx`)
- [ ] Update `src/routes/docs.tsx` — list page, cards link to `/docs/$docId` instead of `<a target="_blank">` (AC: 5)
- [ ] Create `src/routes/docs.$docId.tsx` — detail page, fetch MD file and render with `marked` (AC: 6)
- [ ] Update `src/routes/__root.tsx` — replace 4-Diamond nav with 5-section nav, add Agents submenu (AC: 1, 7, 8)
- [ ] Update `src/routes/route-tree.ts` — register `discoverDefineRoute`, `developDeliverRoute`, `docDetailRoute` (AC: 9)
- [ ] Run `pnpm check` and confirm zero lint/type/build errors

## Dev Notes

### Navigation Active-State Logic (in `__root.tsx`)

Replace all current Diamond section variables with:

```ts
const isHomeActive = currentPath === "/"
const isDiscoverDefineActive = currentPath.startsWith("/discover-define") || currentPath.startsWith("/workflow/analysis") || currentPath.startsWith("/workflow/planning") || currentPath.startsWith("/workflow/solutioning")
const isDevelopDeliverActive = currentPath.startsWith("/develop-deliver") || currentPath.startsWith("/workflow/implementation") || currentPath.startsWith("/epic.") || currentPath.startsWith("/story.")
const isDocsActive = currentPath.startsWith("/docs")
const isAgentsActive = currentPath.startsWith("/agents") || currentPath.startsWith("/sessions") || currentPath.startsWith("/session/") || currentPath.startsWith("/analytics")
```

### Sidebar Structure (in `RootLayout`)

```tsx
<nav>
  {/* Home */}
  <Link className={`sidebar-link ${isHomeActive ? "is-section-active" : ""}`} to="/">
    Home
  </Link>

  {/* Discover & Define */}
  <Link className={`sidebar-link sidebar-link-section ${isDiscoverDefineActive ? "is-section-active" : ""}`} to="/discover-define">
    Discover &amp; Define
  </Link>

  {/* Develop & Deliver */}
  <Link className={`sidebar-link sidebar-link-section ${isDevelopDeliverActive ? "is-section-active" : ""}`} to="/develop-deliver">
    Develop &amp; Deliver
  </Link>

  {/* Documentation */}
  <Link className={`sidebar-link sidebar-link-section ${isDocsActive ? "is-section-active" : ""}`} to="/docs">
    Documentation
  </Link>

  {/* Agents */}
  <Link className={`sidebar-link sidebar-link-section ${isAgentsActive ? "is-section-active" : ""}`} to="/agents">
    Agents
  </Link>
  <div className="sidebar-submenu">
    <Link className="sidebar-sublink" to="/sessions">Sessions</Link>
    {/* Running sessions list — reuse existing session sidebar logic */}
    <Link className="sidebar-sublink" to="/analytics">Analytics</Link>
    {/* analytics sub-items */}
  </div>
</nav>
```

### `/discover-define` Route

- File: `src/routes/discover-define.tsx`
- Export: `discoverDefineRoute` (`createRoute({ getParentRoute: () => rootRoute, path: "/discover-define" })`)
- The page renders 3 accordion panels (Analysis, Planning, Solutioning)
- Accordion: use native `<details>/<summary>` — no external library needed, styleable with Tailwind
- Each phase's content can be a minimal representation (phase title, description, action links to the full workflow phase route) OR embed the phase component. Start simple: show phase name + description + a "Go to full view" link to `/workflow/$phaseId`
- Phase data can be derived from the same `WORKFLOW_PHASES` constant used in `workflow.$phaseId.tsx` (check if it exists) or hardcode the 3 phases inline

### `/develop-deliver` Route

- File: `src/routes/develop-deliver.tsx`
- Export: `developDeliverRoute`
- Sprint planning section: use `useQuery` to fetch from `apiUrl("/api/overview")` → `OverviewResponse`
- Epics section: use `useQuery` for `apiUrl("/api/epics")` OR derive from overview
- **IMPORTANT:** Do NOT duplicate `ActiveSprintSummary` component — either import it from `home.tsx` OR (better) extract it to `src/lib/sprint-summary.tsx` and import in both places
- If extracting, also update `home.tsx` to use the extracted component

### `/docs/$docId` Route

- File: `src/routes/docs.$docId.tsx`
- Export: `docDetailRoute`
- Path: `/docs/$docId` with `docId` param (slugified filename, e.g. `README` → `README.md`)
- Fetch the raw MD file: `IS_LOCAL_MODE ? fetch(doc.path) : fetch(apiUrl("/data/docs/${docId}.json"))`
  - In local mode: fetch the file directly from its path (e.g. `fetch("README.md")`)
  - In production mode: **no live fetch** — static build won't have raw files; render a "not available in production" note or pre-build the content
- Render with `marked`: `import { marked } from "marked"` (already in `package.json` v18.0.0)
- Use `dangerouslySetInnerHTML={{ __html: marked.parse(content) }}` in a `className="prose"` container
- Add back navigation: `<Link to="/docs">← Back to Docs</Link>`
- Use `KNOWN_DOCS` from `docs.tsx` (extract to a shared constant or pass via route context) to resolve `docId` → file path

### `docs.tsx` Updates

- Remove `IS_LOCAL_MODE` branching for `<a target="_blank">` — all doc cards now link to `/docs/$docId`
- Use TanStack Router `<Link to="/docs/$docId" params={{ docId: doc.path.replace(/\//g, '_') }}>` or encode doc path as URL-safe param
- Simplest encoding: use the doc's `path` field directly as the param, URL-encoded by the router

### `route-tree.ts` Updates

Add 3 new route imports and registrations:
```ts
import { discoverDefineRoute } from "./discover-define"
import { developDeliverRoute } from "./develop-deliver"
import { docDetailRoute } from "./docs.$docId"
```

In `rootRoute.addChildren([...])` add:
- `discoverDefineRoute`
- `developDeliverRoute`
- `docDetailRoute` (as sibling of `docsRoute`)

### Project Structure Notes

- All new files go in `src/routes/` (Phase 1 pattern — no `src/ui/` yet)
- Named function components (not arrow const)
- `import type` for type-only imports
- Use `@/*` alias for cross-file imports
- Tailwind utility classes for all new styling (no new CSS classes in `styles.css`)
- Named `const` for all magic values (no inline strings/numbers)
- `marked` v18 API: `marked.parse(content)` returns `string | Promise<string>` — use `String(marked.parse(content))` or await in async context

### Existing Running Sessions Sidebar Logic

The sidebar currently shows running sessions under Deliver. This logic in `__root.tsx` must be PRESERVED under the new Agents submenu. Key pieces:
- `useQuery` for `sidebar-sessions` 
- Filter: `status === "running" && sessionId.startsWith("workflow-")`
- Limit: `SESSIONS_SIDEBAR_LIMIT = 10`
- Renders `toSidebarStoryLabel()` for story ticket labels

### References

- Current nav: `src/routes/__root.tsx` (full sidebar in `RootLayout`)
- Route tree: `src/routes/route-tree.ts`
- Docs list: `src/routes/docs.tsx`
- Agents page: `src/routes/agents.tsx` (unchanged except active state)
- Home sprint logic: `src/routes/home.tsx` (ActiveSprintSummary, epics display)
- Project context: `_bmad-output/project-context.md` (all TypeScript/React/Tailwind rules)
- marked docs: https://marked.js.org/ — v18, `marked.parse()` is synchronous by default

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
