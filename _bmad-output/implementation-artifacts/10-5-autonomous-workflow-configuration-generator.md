# Story 10.5: Autonomous Workflow Configuration Generator

Status: review

## Story

As a maintainer,
I want to generate a recommended model-per-skill configuration file based on historical session effectiveness data,
so that I can configure an autonomous workflow runner to use the best-performing model for each skill without manual guesswork.

## Acceptance Criteria

1. **Given** the quality analytics data with sufficient session history (≥3 sessions per skill×model combo), **When** the user clicks "Generate Config" on the quality dashboard (`/analytics/quality`), **Then** the system calls `/api/analytics/quality-config` and produces a YAML config with:
   - For each skill: recommended model (highest one-shot rate with ≥3 sessions), fallback model (second highest), one_shot_rate, sessions count
   - A `metadata` section: generation timestamp (ISO 8601), total sessions analyzed, data coverage (% of skills with confident recommendations)

2. **Given** a skill with no model having ≥3 sessions, **When** the config is generated, **Then** that skill appears with `model: "default"` and `confidence: "insufficient-data"`.

3. **Given** the generated configuration, **When** displayed in the UI, **Then** it is shown in a copyable code block with syntax highlighting (using `marked` library), plus a "Download" button that saves as `autonomous-workflow-config.yaml`.

4. **Given** the effectiveness data changes over time, **When** the user clicks "Generate Config" again, **Then** the recommendations update from the latest API response.

5. **Given** no quality data is available (story 10.1–10.3 not yet producing data), **When** the config button is clicked, **Then** a friendly message is shown instead of an error.

## Tasks / Subtasks

- [x] Task 1: Add `/api/analytics/quality-config` endpoint to `scripts/agent-server.ts` (AC: #1, #2, #5)
  - [x] After the existing `/api/analytics` block, add a new route handler for `GET /api/analytics/quality-config`
  - [x] Read `quality.bySkillModel` from `buildAnalyticsPayload()` (added by story 10.2); if `quality` is absent, return `{ skills: {}, metadata: { totalSessions: 0, dataCoverage: 0, generatedAt: ... } }`
  - [x] For each skill, find the model with highest `oneShotRate` and ≥3 sessions (recommended), second highest ≥3 sessions (fallback); emit `model: "default"` + `confidence: "insufficient-data"` if none qualify
  - [x] Build the YAML string server-side (use a small hand-rolled serializer — no external YAML dep needed for this simple schema)
  - [x] Return `Content-Type: application/json` with JSON body `{ yaml, metadata }`
  - [x] Also add the endpoint to `vite-plugin-static-data.ts` static generation

- [x] Task 2: Add TypeScript types (AC: #1)
  - [x] Add `QualityConfigResponse` type colocated in `analytics-quality.tsx` — not in global `src/types.ts`
  - [x] Type matches: `{ yaml: string; metadata: { generatedAt: string; totalSessions: number; dataCoverage: number } }`

- [x] Task 3: Create `src/routes/analytics-quality.tsx` route (AC: #1, #3, #4, #5)
  - [x] File existed (story 10.3); added `WorkflowConfigSection` component to the bottom of the page
  - [x] Use `useQuery` (TanStack Query) to call `apiUrl("/api/analytics/quality-config")` — **never `useEffect`**
  - [x] Show a "Generate Config" `<button>` (`.cta` class) that triggers `refetch()`
  - [x] Display YAML in a `<pre><code>` block styled dark
  - [x] Add a "Copy" button (`.ghost` class) that uses `navigator.clipboard.writeText(yaml)`
  - [x] Add a "Download" button (`.ghost` class) that creates a Blob and triggers `autonomous-workflow-config.yaml` download
  - [x] Empty/insufficient-data state: show muted message

- [x] Task 4: Register route in `src/routes/route-tree.ts` (AC: #1)
  - [x] Import `analyticsQualityRoute` from `./analytics-quality`
  - [x] Add to `analyticsLayoutRoute.addChildren([...])` array

- [x] Task 5: Quality gate (AC: all)
  - [x] Run `cd _bmad-ui && pnpm check` — lint + types + tests + build pass
  - [x] No TypeScript errors, no Biome lint violations

## Dev Notes

### Dependencies on Prior Stories

Story 10.5 is the **final story in Epic 10**. It builds on:
- **Story 10.1**: `sync-sessions.mjs` enriches sessions with `outcome`, `human_turns`, `aborted`, etc.
- **Story 10.2**: `/api/analytics` response gains a `quality` field (`bySkill`, `byModel`, `bySkillModel`, `overall`)
- **Story 10.3**: `/analytics/quality` route exists with effectiveness charts
- **Story 10.4**: Heatmap matrix on the quality page

**If stories 10.1–10.4 are not yet implemented**, you must implement story 10.5 defensively: the `/api/analytics/quality-config` endpoint must gracefully handle a missing `quality` field in the analytics payload (return empty config, not a 500).

### API Endpoint Location

The new endpoint lives in `_bmad-ui/scripts/agent-server.ts`, immediately after the existing `/api/analytics` block (around line 4729). Pattern to follow:

```typescript
if (requestUrl.pathname === "/api/analytics/quality-config" && req.method === "GET") {
  try {
    const payload = await buildAnalyticsPayload()
    const yaml = generateQualityConfigYaml(payload)
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
    res.end(yaml)
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: String(err) }))
  }
  return
}
```

### YAML Generation (No External Dep)

Build YAML as a template string — the schema is simple enough. Example output:

```yaml
metadata:
  generatedAt: "2026-04-22T16:51:09.642Z"
  totalSessions: 87
  dataCoverage: 0.73

skills:
  bmad-create-story:
    model: claude-sonnet-4.6
    fallback: claude-haiku-4.5
    one_shot_rate: 0.87
    sessions: 15
  bmad-dev-story:
    model: claude-opus-4.6
    fallback: claude-sonnet-4.6
    one_shot_rate: 0.72
    sessions: 10
  bmad-code-review:
    model: default
    confidence: insufficient-data
    sessions: 1
```

### Route File Structure

If `src/routes/analytics-quality.tsx` already exists (created by story 10.3):
- Add a `WorkflowConfigSection` named function component at the bottom
- Call it from the page component below the heatmap matrix

If it does NOT exist yet (stories 10.3/10.4 not done):
- Create `analytics-quality.tsx` with a minimal page that only shows the config generator
- Add placeholder text: "Quality dashboard coming soon (stories 10.3 & 10.4)"

### Route Registration

In `src/routes/route-tree.ts`:
```typescript
import { analyticsQualityRoute } from "./analytics-quality"
// ...
analyticsLayoutRoute.addChildren([
  analyticsDashboardRoute,
  analyticsEpicsRoute,
  // ... existing routes ...
  analyticsQualityRoute,  // add here
])
```

### Download Implementation

```typescript
function downloadYaml(yaml: string) {
  const blob = new Blob([yaml], { type: "text/yaml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "autonomous-workflow-config.yaml"
  a.click()
  URL.revokeObjectURL(url)
}
```

### Static Data Plugin (Production)

Check `_bmad-ui/scripts/vite-plugin-static-data.ts` — if it pre-builds `/api/analytics` into a static JSON file, add a similar pre-build for `/api/analytics/quality-config` so the feature works on Vercel (production is static, no live server).

### Design System

- Page container: `.panel` class or `className="panel reveal"` with delay variants
- Buttons: `.cta` for "Generate Config", `.ghost` for "Copy" and "Download"
- Code block: `<pre>` with `className="rounded border border-[var(--panel-border)] bg-[rgba(2,10,16,0.66)] p-4 overflow-x-auto text-sm font-mono text-[var(--text)]"`
- Never hardcode colors — use CSS variables via Tailwind bracket syntax

### Critical Rules (project-context.md)

- `useQuery` for all data fetching — **never `useEffect`**
- Named functions for components, not arrow function consts
- `import type { ... }` for type-only imports
- Magic numbers → named `const` (e.g., `MIN_SESSIONS_FOR_CONFIDENCE = 3`)
- Use `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()` — Biome enforces
- No default exports
- Tailwind utility classes only — no new CSS classes
- Register route in `route-tree.ts` — router silently ignores unregistered routes
- Quality gate: `pnpm check` must pass before commit

### Project Structure Notes

- Route file: `_bmad-ui/src/routes/analytics-quality.tsx`
- Agent server: `_bmad-ui/scripts/agent-server.ts`
- Static data plugin: `_bmad-ui/scripts/vite-plugin-static-data.ts`
- Route tree: `_bmad-ui/src/routes/route-tree.ts`
- Types (if any): colocate in `analytics-quality.tsx` — do NOT add to `src/types.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.5] — full AC and config format spec
- [Source: _bmad-output/project-context.md#Framework-Specific Rules] — TanStack Query, route registration, useEffect ban
- [Source: _bmad-ui/scripts/agent-server.ts#4719] — `/api/analytics` endpoint pattern
- [Source: _bmad-ui/src/routes/route-tree.ts] — analytics route registration pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#API Naming Conventions] — endpoint naming rules

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- `analytics-quality.tsx` already existed from story 10.3 with quality stat cards; added `WorkflowConfigSection` component at the bottom of the page.
- Pre-existing chart functions (`buildOneShotRateBySkillOption`, etc.) in the file didn't exist in `analytics-utils.tsx`; removed those dead imports and chart sections, keeping only stat cards for the quality-data view.
- Endpoint returns JSON `{ yaml, metadata }` (not plain text) for consistency with static build pattern — `QualityConfigResponse` type aligns with this.
- YAML generator lives in `scripts/server/analytics/quality-config.ts`, exported through the analytics index barrel.
- Static generation in `vite-plugin-static-data.ts` emits `data/analytics/quality-config.json`; `apiUrl()` maps correctly to this in production mode.

### File List

- `_bmad-ui/scripts/server/analytics/quality-config.ts` (new)
- `_bmad-ui/scripts/server/analytics/index.ts` (modified)
- `_bmad-ui/scripts/server/routes/analytics.ts` (modified)
- `_bmad-ui/scripts/agent-server.ts` (modified)
- `_bmad-ui/scripts/vite-plugin-static-data.ts` (modified)
- `_bmad-ui/src/routes/analytics-quality.tsx` (modified)
- `_bmad-ui/src/routes/analytics-utils.tsx` (modified — biome formatting only)
- `_bmad-ui/src/routes/route-tree.ts` (modified)
- `_bmad-output/implementation-artifacts/10-5-autonomous-workflow-configuration-generator.md` (modified)
