# Story 10.1: Enrich Session Sync Daemon with Outcome & Complexity Metrics

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the sync-sessions daemon to extract rich outcome and complexity metrics from Copilot CLI events.jsonl logs and fully backfill all historical sessions from local logs,
so that agent-sessions.json contains complete, accurate quality data for every past and future session without manual annotation.

## Acceptance Criteria

1. **Given** a Copilot CLI session with events.jsonl containing `user.message`, `tool.execution_start`, `abort`, `session.error`, `session.compaction_start`, and subagent events,
   **When** the sync daemon processes the session,
   **Then** it extracts and persists the following fields to agent-sessions.json:
   - `human_turns` (number) — count of real user messages, excluding auto-injected XML wrappers
   - `agent_turns` (number) — count of `assistant.turn_end` events
   - `git_commits` (number) — count of bash tool calls containing `git commit`
   - `git_pushes` (number) — count of bash tool calls containing `git push`
   - `aborted` (boolean) — whether an `abort` event occurred
   - `context_compactions` (number) — count of `session.compaction_start` events
   - `subagent_count` (number) — count of `subagent.started` events
   - `subagent_tokens` (number) — sum of `totalTokens` from `subagent.completed` events
   - `error_count` (number) — count of `session.error` events
   - `duration_minutes` (number) — wall-clock time from session start to last event (total elapsed)
   - `agent_active_minutes` (number) — sum of per-turn active time only: time from each `user.message` timestamp to the next `assistant.turn_end` timestamp; excludes idle time while the human is composing the next prompt
   - `outcome` (string) — one of: `"pushed"`, `"committed"`, `"delivered"`, `"aborted"`, `"error"`, `"no-output"`

2. **Given** a session using a non-committing skill,
   **When** the session completes without abort or error and has at least one agent turn,
   **Then** the outcome is `"delivered"` — these skills never produce git commits by design; their output IS the review/plan/analysis

3. **Given** the `NON_COMMITTING_SKILLS` set must stay current as new skills are added,
   **When** a developer adds a new non-committing skill to the project,
   **Then** they update `_bmad-ui/agents/skills-config.json` (the single source of truth for skill classification) rather than modifying `sync-sessions.mjs` directly; the daemon reads `nonCommittingSkills` from this file at startup

4. **Given** the sync daemon running in watch mode,
   **When** a session was already synced as `status: "completed"` with all outcome fields populated (including `agent_active_minutes`),
   **Then** it is skipped on subsequent polls to avoid re-parsing large files

5. **Given** the sync daemon started with `--once`,
   **When** all historical sessions exist in `~/.copilot/session-state/`,
   **Then** all sessions for this project are processed and the daemon exits within 30 seconds (NFR23)

6. **Given** the existing `agent-sessions.json` with sessions that have the old schema (no outcome or `agent_active_minutes` fields),
   **When** the sync daemon runs,
   **Then** it enriches those sessions with the new fields via upsert without losing existing data (storyId, epicId, notes, etc.)

7. **Given** this computer has 359 CLI session directories in `~/.copilot/session-state/`,
   **When** `node scripts/sync-sessions.mjs --once` is run,
   **Then** all sessions belonging to this project (identified by `cwd` containing `/lorenzogm/bmad-ui`) are parsed and written to `agent-sessions.json`; sessions already fully enriched are skipped for efficiency

8. **Given** the sessions list view at `/sessions` and session detail view at `/session/:id`,
   **When** session data is loaded from the API,
   **Then** the `outcome`, `agent_active_minutes`, `human_turns`, `agent_turns`, `git_commits`, and `git_pushes` fields are displayed or available for display in the UI without JavaScript errors

9. **Given** the sessions UI at `/sessions`,
   **When** a Playwright E2E test suite runs against a controlled fixture containing sessions with the new schema fields,
   **Then** all tests pass with zero JavaScript errors, verifying:
   - Sessions list renders with correct status badges
   - Each session row shows skill, model, outcome, and duration
   - Clicking a session row navigates to the session detail page
   - Session detail page renders without errors
   - A dummy epic with test sessions is created, all actions verified (run skill, view session, navigation), then the dummy data is cleaned up so no test artifacts persist

## Tasks / Subtasks

- [x] Add `agent_active_minutes` field to `parseCLISession()` (AC: 1)
  - [x] Track per-turn timing: record timestamp of each `user.message` event; on the next `assistant.turn_end`, add `(turn_end_ts - user_message_ts)` to accumulator
  - [x] Store result in `agent_active_minutes` (rounded to 1 decimal place, same as `duration_minutes`)
  - [x] Update the skip-completed guard in `syncSessions()` to also require `agent_active_minutes` is populated before skipping (AC: 4)

- [x] Extract skill classification to external config file (AC: 3)
  - [x] Create `_bmad-ui/agents/skills-config.json` with `{ "nonCommittingSkills": [...] }` containing the full current set
  - [x] Update `sync-sessions.mjs` to load `NON_COMMITTING_SKILLS` from this file at startup (fallback to hardcoded set if file missing/malformed)
  - [x] Ensure the file is not gitignored and is committed as part of this story

- [x] Full historical backfill (AC: 7)
  - [x] Run `cd _bmad-ui && time node scripts/sync-sessions.mjs --once` on this machine
  - [x] Verify all 359 `~/.copilot/session-state/` sessions are scanned; count how many belong to this project and are written to `agent-sessions.json`
  - [x] Verify completion within 30 seconds (NFR23)
  - [x] Commit the resulting `agent-sessions.json` with updated records

- [x] Wire new fields through API and types (AC: 8)
  - [x] Add `agent_active_minutes`, `human_turns`, `agent_turns`, `git_commits`, `git_pushes`, `outcome` to `SessionAnalyticsData` type in `scripts/agent-server.ts`
  - [x] Add the same fields to `SessionAnalytics` type in `src/types.ts`
  - [x] Ensure `analyticsToRuntimeSession()` passes these fields through so they are available in session detail responses
  - [x] Update the `/api/analytics` response to include these fields per session

- [x] Add Vitest unit tests for `parseCLISession()` logic (AC: 1, 2, 4)
  - [x] Test: `user.message` events with auto-injected XML stripped and real content counted correctly as `human_turns`
  - [x] Test: `tool.execution_start` bash calls with `git commit` and `git push` produce correct `git_commits`/`git_pushes`
  - [x] Test: `abort` event → `outcome: "aborted"`
  - [x] Test: `bmad-code-review` skill with no git activity + agentTurns > 0 → `outcome: "delivered"`
  - [x] Test: `session.error` events → correct `error_count`
  - [x] Test: `subagent.started` and `subagent.completed` events → correct `subagent_count`/`subagent_tokens`
  - [x] Test: `agent_active_minutes` accumulates only user-message-to-turn-end durations, not idle gaps
  - [x] Test: already-completed session with `outcome` and `agent_active_minutes` populated → skipped in subsequent sync

- [x] Add Playwright E2E tests for sessions UI with new fields (AC: 9)
  - [x] Create `tests/fixtures/analytics-with-outcome-sessions.json` containing 3–5 sessions with full new-schema fields (`outcome`, `agent_active_minutes`, `human_turns`, etc.), including at least one `"pushed"`, one `"delivered"`, one `"aborted"` outcome
  - [x] Add test: sessions list renders all rows without JS errors; `outcome` values appear in each row
  - [x] Add test: clicking a session navigates to `/session/:id` and detail page renders without JS errors
  - [x] Add test: session detail page shows `agent_active_minutes` duration (prefer asserting on the element rather than exact value)
  - [x] Add dummy-epic fixture to `tests/fixtures/` for epic workflow action tests; run all existing epic action tests against it; confirm no test creates persistent test artifacts in `agent-sessions.json`
  - [x] Verify `pnpm test:e2e` passes with zero failures

- [x] Run `cd _bmad-ui && pnpm check` to verify quality gate passes

### Review Findings

- [x] [Review][Patch] Avoid false-positive `git_commits` counting from generic `git -c` commands in `tool.execution_start` parsing [`_bmad-ui/scripts/sync-sessions.mjs`]
- [x] [Review][Patch] Add regression coverage to ensure non-commit `git -c` invocations do not change outcome classification [`_bmad-ui/scripts/sync-sessions.test.mjs`]

## Dev Notes

### ⚠️ Core Implementation Already Exists — Focus on Gaps

`_bmad-ui/scripts/sync-sessions.mjs` already handles most of Story 10.1. The new work is:
1. **`agent_active_minutes`** — NEW field, not yet implemented; replaces naive wall-clock `duration_minutes` for "how long was the agent actually working"
2. **`skills-config.json`** — extract `NON_COMMITTING_SKILLS` to an external file so it is maintainable without touching the daemon
3. **Historical backfill** — run `--once` and commit the result
4. **Type plumbing** — surface new fields in `SessionAnalyticsData`, `SessionAnalytics`, and `analyticsToRuntimeSession()`
5. **E2E tests** — the sessions UI has no dedicated E2E coverage for the new fields

### `agent_active_minutes` vs `duration_minutes`

`duration_minutes` = wall-clock from `session.start` to last event (includes idle time waiting for human)

`agent_active_minutes` = sum of individual turn response times:
```
for each user.message event at timestamp T_user:
    find next assistant.turn_end at timestamp T_end
    active_ms += (T_end - T_user)
agent_active_minutes = round(active_ms / 60_000, 1)
```
This is the measure of "how long the agent was thinking/working", not how long the session was open.

### Key File Locations

| File | Purpose |
|---|---|
| `_bmad-ui/scripts/sync-sessions.mjs` | Daemon — parseCLISession(), syncSessions() |
| `_bmad-ui/agents/agent-sessions.json` | Target sessions store (413 sessions as of story creation) |
| `_bmad-ui/agents/skills-config.json` | NEW — skill classification config (create this file) |
| `_bmad-ui/scripts/agent-server.ts` | API — SessionAnalyticsData type, analyticsToRuntimeSession() |
| `_bmad-ui/src/types.ts` | Frontend types — SessionAnalytics (add new fields) |
| `_bmad-ui/src/routes/sessions.tsx` | Sessions list UI |
| `_bmad-ui/src/routes/session.$sessionId.tsx` | Session detail UI |
| `_bmad-ui/tests/session-traces.spec.ts` | Existing session E2E tests (extend, don't replace) |
| `_bmad-ui/tests/fixtures/` | JSON fixtures used by Playwright tests |

### skills-config.json Schema

```json
{
  "nonCommittingSkills": [
    "bmad-code-review",
    "bmad-sprint-planning",
    "bmad-sprint-status",
    "bmad-retrospective",
    "bmad-validate-prd",
    "bmad-review-adversarial-general",
    "bmad-review-edge-case-hunter",
    "bmad-check-implementation-readiness",
    "bmad-checkpoint-preview"
  ]
}
```

### Outcome Derivation Rules (priority order — unchanged)

```
"aborted"   — abort event found
"error"     — session.error event found
"pushed"    — bash git push detected
"committed" — bash git commit detected (but no push)
"delivered" — non-committing skill + agentTurns > 0 + no abort/error
"no-output" — none of the above
```

### human_turns Filtering

`AUTO_INJECTED_XML_RE` strips these XML wrappers before counting: `skill-context`, `reminder`, `context`, `current_datetime`, `invoked_skills`, `userRequest`, `system_notification`, `summary`, `available_skills`, `plan_mode`. Messages with ≤10 chars remaining are NOT counted.

### E2E Test Pattern (follow existing tests)

Existing session tests in `tests/session-traces.spec.ts` use `mockApi` + fixture JSON to avoid real API calls. Follow the same pattern for new tests. Do NOT rely on `agent-sessions.json` at test time — use controlled fixtures so tests are deterministic.

The "dummy epic" for workflow action testing means: add a fixture JSON mimicking an epic response and test the sessions+epic actions via `mockApi`. Do NOT write test data to the real `agent-sessions.json` or `sprint-status.yaml`. All test state lives in fixture files and in-memory mock routes only.

### Current State of agent-sessions.json

As of 2026-04-22:
- 253 CLI sessions with new schema fields (`outcome`, `human_turns`, etc.) — but `agent_active_minutes` NOT yet present
- 160 legacy `workflow-*` sessions with old schema — kept as-is, not re-parsed

### NFR23 Performance Budget

30 seconds for `--once` across all 359 session directories. Current sync is synchronous I/O; if it exceeds budget, consider `Promise.all` for parallel file reads.

### Project-Context Key Rules

- Never use `useEffect` for data fetching — TanStack Query only
- Route files: `src/routes/` — always register new routes in `src/routes/route-tree.ts`
- Types colocated with consumers; do NOT add to `src/types.ts` unless it is a shared API response type
- Biome 2.4.12: `Number.isNaN()`, no barrel files, named function components, `import type`
- CSS variables only — no hardcoded colors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] — original ACs, FR41, FR44, NFR23, NFR24
- [Source: _bmad-output/planning-artifacts/epics.md#NFR23] — 30-second processing budget
- [Source: _bmad-output/planning-artifacts/epics.md#NFR24] — local-only metrics (no network)
- [Source: _bmad-ui/scripts/sync-sessions.mjs] — existing daemon implementation
- [Source: _bmad-ui/scripts/agent-server.ts:2947] — SessionAnalyticsData type to extend
- [Source: _bmad-ui/src/types.ts:277] — SessionAnalytics frontend type to extend
- [Source: _bmad-ui/tests/session-traces.spec.ts] — E2E test pattern to follow
- [Source: _bmad-output/project-context.md] — TypeScript/Biome/React rules

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Story updated 2026-04-22: added `agent_active_minutes` (agent-active time excluding idle), `skills-config.json` external config AC, historical backfill AC, type plumbing tasks, and E2E test tasks
- Core daemon implementation pre-built; primary gaps are `agent_active_minutes`, skills-config extraction, type wiring, and test coverage
- 253 CLI sessions already enriched; none have `agent_active_minutes` yet — all need re-parse
- Implementation complete 2026-04-23: all ACs satisfied
- Historical backfill: 449 sessions processed in 0.395s (NFR23 ≤30s ✅)
- 12 Vitest unit tests added, all passing
- 5 Playwright E2E tests added, all 46 suite tests passing
- `pnpm check` passes with zero errors

### File List

**Created:**
- `_bmad-ui/agents/skills-config.json` — nonCommittingSkills external config (AC 3)
- `_bmad-ui/scripts/sync-sessions.test.mjs` — 12 Vitest unit tests for parseCLISessionContent
- `_bmad-ui/tests/fixtures/analytics-with-outcome-sessions.json` — 3-session fixture with pushed/delivered/aborted outcomes
- `_bmad-ui/tests/outcome-sessions.spec.ts` — Playwright E2E tests for sessions list + detail with new fields

**Modified:**
- `_bmad-ui/scripts/server/analytics/costing.ts` — Added 12 new optional fields to `AgentSession` and `SessionAnalyticsData` types
- `_bmad-ui/scripts/server/analytics/store.ts` — Updated `readAnalyticsStore()` normalization and `analyticsToRuntimeSession()` to pass through new fields
- `_bmad-ui/scripts/server/runtime/state.ts` — Added optional new fields to server-side `RuntimeSession` type
- `_bmad-ui/src/types.ts` — Added new fields to `SessionAnalytics`, `RuntimeSession`; added `AnalyticsQuality`/`SkillQualityBucket`/`ModelQualityBucket` types; added `quality?` to `AnalyticsResponse`
- `_bmad-ui/src/routes/sessions.tsx` — Added Outcome column header + cell to sessions table
- `_bmad-ui/src/routes/session.$sessionId.tsx` — Added `agentActiveMinutes` and `outcome` rows to metadata panel
- `_bmad-ui/tests/fixtures/session-with-logs.json` — Added `outcome`, `agentActiveMinutes`, `humanTurns`, `agentTurns`, `gitCommits`, `gitPushes` to fixture session
- `_bmad-ui/agents/agent-sessions.json` — Updated with backfill results (449 sessions, new fields populated)
