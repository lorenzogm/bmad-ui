# Story 7.5: Deep E2E Coverage for Workflow Actions and Session Traces

Status: done

## Story

As a maintainer,
I want deterministic E2E coverage for current workflow actions, artifact sync, and session traces,
so that broken `Plan all stories`, `Develop all stories`, story-sync, and session-log behaviors are caught before they ship.

## Acceptance Criteria

1. **Given** the current Playwright suite is mostly smoke coverage, **When** Story 7.5 is implemented, **Then** the E2E suite adds deterministic interaction scenarios for existing Phase 1 features beyond page-load checks **And** those scenarios can run locally and in CI without depending on live Copilot responses.

2. **Given** an epic contains a mix of planned-only, ready, in-progress, and done stories, **When** the suite exercises the epic detail page and its action paths (`Plan all stories`, `Develop all stories`, and the per-story prepare/start flow), **Then** only eligible stories are targeted **And** state transitions become visible in the UI **And** the tests fail if already-created stories are re-planned, bulk orchestration silently stalls, or action failures are hidden behind no-op behavior.

3. **Given** `epics.md`, `sprint-status.yaml`, and runtime session data can change independently, **When** the suite loads the home, epic detail, story detail, and workflow-connected views against real and intentionally mismatched artifact states, **Then** planned stories, story counts, story statuses, and story-to-session links remain consistent **And** visible warnings or empty states appear instead of silent inconsistency.

4. **Given** session detail depends on synthesized log data, **When** the suite opens sessions with populated logs, missing logs, and actively running output, **Then** the page shows the correct conversation, waiting, summary, or empty-state view **And** the tests fail if session log content is blank, stale, or inconsistent with the session status.

5. **Given** known flaky behaviors exist in the current baseline, **When** Story 7.5 is completed, **Then** at least the `Plan all stories` / `Develop all stories` reliability gaps and inconsistent session-log visibility are reproduced by failing tests first **And** those regressions remain covered by the final passing suite.

## Tasks / Subtasks

- [x] Create `tests/workflow-actions.spec.ts` covering epic bulk action scenarios (AC: #1, #2)
  - [x] Mock `/api/epic/:epicId` responses to simulate a mix of planned-only, ready, in-progress, and done stories
  - [x] Verify `Plan all stories (N)` button renders **only** when there are unplanned stories and is disabled in prod mode
  - [x] Verify `Develop all stories` button renders **only** when there are ready-for-dev stories and is disabled in prod mode
  - [x] Verify already-planned stories are **not** included in `storiesNeedingPlan` (button count reflects eligible count)
  - [x] Intercept POST `/api/workflow/:skill/:storyId` and assert correct story IDs are sent (no duplicates, no already-done stories)
  - [x] Assert `bulkError` banner appears when any bulk request returns a non-409 error
  - [x] Assert orchestration stop button appears during `Develop all stories` run and clicking it clears `isOrchestrating`

- [x] Create `tests/artifact-consistency.spec.ts` covering data consistency across views (AC: #1, #3)
  - [x] Mock `/api/overview` to return known epic/story counts and assert home page stat numbers match
  - [x] Mock `/api/epic/:epicId` to return stories in mixed statuses and assert story table row count, status badges match
  - [x] Assert a story with status `done` shows the `Done` badge class (`.step-badge.step-done`)
  - [x] Assert a story with status `backlog` shows the correct muted badge style
  - [x] Mock mismatched data (epic says 3 stories, sprint-status has 4) and assert no JS crash — graceful table render
  - [x] Assert navigation from epic detail story row to `/stories/:storyId` loads the story detail without JS errors

- [x] Create `tests/session-traces.spec.ts` covering session log state variants (AC: #1, #4)
  - [x] Mock `/api/session/:sessionId` with `logExists: true`, `logContent: "<populated log>"`, `isRunning: false` — assert log entries render inside `.chat-log-collapse`
  - [x] Mock with `logExists: false`, `logContent: null`, `isRunning: false` — assert `.chat-empty-state` shows "No log output" and muted path hint
  - [x] Mock with `logExists: true`, `logContent: null`, `isRunning: true` — assert "Waiting for agent output…" state and typing indicator renders
  - [x] Mock with `summary` present and `isRunning: false` — assert `.chat-session-summary` section is visible
  - [x] Assert `/sessions` list page shows sessions table with at least one row when `/api/analytics` returns session data
  - [x] Assert clicking a session row in the list navigates to `/session/:sessionId` detail page without JS errors

- [x] Add network-mocking helpers (AC: #1)
  - [x] Extract a shared `mockApi(page, route, fixture)` helper in `tests/helpers/mock-api.ts` to reduce boilerplate
  - [x] Add minimal fixture JSON files in `tests/fixtures/` for epic response, overview response, session detail response variants

- [x] Verify full suite passes CI: `cd _bmad-custom/bmad-ui && pnpm run check:e2e` (AC: #1, #5)
  - [x] All new tests pass headless with Chromium
  - [x] Existing `smoke.spec.ts` tests still pass (no regressions)
  - [x] CI YAML already includes E2E from Story 7.4 — no CI config changes needed

### Review Findings

- [x] [Review][Patch] Synchronize non-409 Develop-all error test with workflow POST response [`_bmad-custom/bmad-ui/tests/workflow-actions.spec.ts:201`]

## Dev Notes

### Test Strategy: Network Mocking in Playwright

All new tests **must** use `page.route()` (Playwright network interception) to mock API responses — **do not rely on live dev server data**. The dev server is only used for rendering the app shell; all API responses are intercepted.

```typescript
// Pattern: intercept before navigation
await page.route("/api/epic/epic-7", async (route) => {
  await route.fulfill({ json: epicFixture })
})
await page.goto("/epics/epic-7")
```

### IS_LOCAL_MODE in Tests

The dev server runs with `pnpm dev` (which sets `import.meta.env.DEV = true`), so `IS_LOCAL_MODE` is `true` in test runs. This means:
- `Plan all stories` and `Develop all stories` buttons are **enabled** in tests (not disabled by PROD_DISABLED_TITLE)
- Action buttons (start session, abort session) are **enabled** in tests
- POST requests to `/api/workflow/*` and `/api/session/*` will be made — **always intercept them to prevent real side effects**

### Epic Detail Page: Key Selectors

No `data-testid` attributes exist on the epic detail page. Use these selectors:

| Target | Selector |
|---|---|
| Plan all stories button | `button.cta:has-text("Plan all stories")` |
| Develop all stories button | `button:has-text("Develop all stories")` |
| Stop orchestration button | `button.ghost:has-text("Stop")` |
| Bulk error banner | `.error-banner` |
| Stories table | `table` (inside `.panel`) |
| Story status badge | `.step-badge` |
| Story row (done) | `.step-badge.step-done` |
| Progress bar | `.epic-progress-fill` |

### Session Detail Page: Key Selectors

| Target | Selector |
|---|---|
| Log entries present | `.chat-log-collapse` |
| No log / empty state | `.chat-empty-state` |
| Typing indicator (waiting) | `.chat-typing-indicator` |
| Session summary | `.chat-session-summary` |
| Muted log path hint | `.chat-empty-state .muted` |

### Workflow Action Logic (from `epic.$epicId.tsx`)

- `storiesNeedingPlan` = planned-only story IDs (from `data.plannedStories`) **plus** stories whose `create-story` step is not yet `"completed"` and whose status is neither `done` nor `in-progress`. Stories with `id.endsWith("-")` are planned-only entries.
- `showDevelopAllButton` = `stories.some(s => s.steps["bmad-create-story"] === "completed" && s.status !== "done")`
- Plan POST target: `POST /api/workflow/bmad-create-story/:storyId` — one per story in `storiesNeedingPlan`
- Develop POST target: `POST /api/workflow/bmad-dev-story/:storyId` — sequential, gated by orchestration state
- HTTP 409 on POST = story already in progress → **silently skip** (no error banner)
- Any other non-2xx = sets `bulkError` state → banner renders

### Session Detail Log Parsing (from `session.$sessionId.tsx`)

Log content is plain text with markers like `[TOOL_USE]`, `[TOOL_RESULT]`, `[USER_TURN]`, `[SYSTEM]`. The parser (`parseLogIntoEntries`) returns `LogEntry[]`. If `logContent` is `null` or empty string → `entries.length === 0`. State matrix:

| `entries.length` | `isRunning` | `logExists` | Rendered UI |
|---|---|---|---|
| 0 | false | true | `.chat-empty-state` "No log output" |
| 0 | false | false | `.chat-empty-state` "No log output" + muted path |
| 0 | true | any | `.chat-empty-state` "Waiting for agent output…" + typing indicator |
| > 0 | false | true | `.chat-log-collapse` + optional `.chat-session-summary` if `summary` set |
| > 0 | true | true | `.chat-log-collapse` + active `.chat-typing-indicator` |

### Fixture File Structure

Create minimal fixtures in `tests/fixtures/`:

```
tests/
  fixtures/
    epic-with-mixed-stories.json    # EpicDetailResponse with planned, ready, done stories
    overview-known-counts.json      # OverviewResponse with known epic/story stats
    session-with-logs.json          # SessionDetailResponse: logExists=true, logContent, isRunning=false, summary
    session-no-log.json             # SessionDetailResponse: logExists=false, logContent=null, isRunning=false
    session-running.json            # SessionDetailResponse: logExists=true, logContent=null, isRunning=true
    analytics-with-sessions.json    # AnalyticsResponse with at least one session row
```

Fixture shapes come from `src/types.ts`:
- `EpicDetailResponse`: `{ epicId, epicNumber, title, goal, stories: Story[], plannedStories: string[] }`
- `SessionDetailResponse`: `{ session: RuntimeSession, logContent, logExists, isRunning, summary, promptContent }`
- `AnalyticsResponse`: `{ sessions: SessionAnalytics[], ... }`

### Existing Test File to NOT Break

`tests/smoke.spec.ts` — existing smoke tests must still pass. Do not modify it. New test files are additive.

### Package.json Scripts

No new scripts needed. Use existing `pnpm run check:e2e` which runs `pnpm exec playwright test`.

### File Locations

| File | Action |
|---|---|
| `tests/workflow-actions.spec.ts` | Create |
| `tests/artifact-consistency.spec.ts` | Create |
| `tests/session-traces.spec.ts` | Create |
| `tests/helpers/mock-api.ts` | Create |
| `tests/fixtures/*.json` | Create (6 fixture files) |

**No changes to `src/` files.** This is a pure test-addition story.

### Project Structure Notes

- Test files live in `_bmad-custom/bmad-ui/tests/` — same directory as `smoke.spec.ts`
- Playwright config (`playwright.config.ts`) already exists at `_bmad-custom/bmad-ui/` root
- `pnpm exec playwright test` from `_bmad-custom/bmad-ui/` discovers all `*.spec.ts` under `tests/`
- `baseURL` is `http://localhost:5173` (Vite dev server)
- Chromium only in CI (`projects: [{ name: "chromium" }]`)

### References

- [Source: epics.md#Story-7.5] — User story, acceptance criteria, FR47, FR50, FR51, FR52
- [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx] — Plan all stories / Develop all stories logic, orchestration state, `storiesNeedingPlan`, `showDevelopAllButton`, `bulkError`, HTTP 409 handling
- [Source: _bmad-custom/bmad-ui/src/routes/session.$sessionId.tsx] — `parseLogIntoEntries`, `logExists`, `isRunning`, `summary` rendering states, `.chat-empty-state` / `.chat-log-collapse` / `.chat-typing-indicator`
- [Source: _bmad-custom/bmad-ui/src/routes/sessions.tsx] — Sessions list query using `/api/analytics`, `AnalyticsResponse` shape
- [Source: _bmad-custom/bmad-ui/src/lib/mode.ts] — `IS_LOCAL_MODE = import.meta.env.DEV` (true in test runs)
- [Source: _bmad-custom/bmad-ui/src/types.ts] — `EpicDetailResponse`, `SessionDetailResponse`, `AnalyticsResponse`, `StoryStatus`, `RuntimeSession`
- [Source: _bmad-custom/bmad-ui/playwright.config.ts] — Test config: baseURL, webServer, chromium only
- [Source: _bmad-custom/bmad-ui/tests/smoke.spec.ts] — Existing patterns: `captureConsoleErrors`, `page.goto`, `expect(page.locator(...)).toBeVisible()`
- [Source: _bmad-output/implementation-artifacts/7-1-set-up-playwright-infrastructure-and-first-smoke-tests.md] — Playwright setup decisions
- [Source: _bmad-output/project-context.md] — Tech stack, testing rules, named constants, Biome rules

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- All 41 tests pass (31 new + 10 existing smoke tests). No regressions.
- Actual POST endpoint is `/api/workflow/run-skill` with JSON body `{ skill, storyId }` — story dev notes incorrectly stated `/api/workflow/:skill/:storyId`.
- `filteredStories` on epic detail page includes `plannedStories` IDs (adds rows beyond `stories.length`); test row counts account for this.
- Node.js 22 requires `with { type: "json" }` import assertions for JSON imports in test files.
- Home page stat card `<p>` number is not a sibling of `h3` due to intermediate `div.flex`; use `div.panel` container filter instead of XPath sibling traversal.
- EventSource SSE connections are mocked via `abortRoute("**/api/events/**")` to prevent connection attempts during tests.

### File List

- `tests/fixtures/epic-with-mixed-stories.json` — new
- `tests/fixtures/overview-known-counts.json` — new
- `tests/fixtures/session-with-logs.json` — new
- `tests/fixtures/session-no-log.json` — new
- `tests/fixtures/session-running.json` — new
- `tests/fixtures/analytics-with-sessions.json` — new
- `tests/helpers/mock-api.ts` — new
- `tests/workflow-actions.spec.ts` — new
- `tests/artifact-consistency.spec.ts` — new
- `tests/session-traces.spec.ts` — new
