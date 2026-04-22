# Story 10.1: Enrich Session Sync Daemon with Outcome & Complexity Metrics

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the sync-sessions daemon to extract rich outcome and complexity metrics from Copilot CLI events.jsonl logs,
so that each session in agent-sessions.json contains the data needed to determine session quality without manual annotation.

## Acceptance Criteria

1. **Given** a Copilot CLI session with events.jsonl containing `user.message`, `tool.execution_start`, `abort`, `session.error`, `session.compaction_start`, and subagent events,
   **When** the sync daemon processes the session,
   **Then** it extracts and persists the following additional fields to agent-sessions.json:
   - `human_turns` (number) — count of real user messages, excluding auto-injected `<skill-context>` and `<reminder>` wrapper content
   - `agent_turns` (number) — count of `assistant.turn_end` events
   - `git_commits` (number) — count of bash tool calls containing `git commit`
   - `git_pushes` (number) — count of bash tool calls containing `git push`
   - `aborted` (boolean) — whether an `abort` event occurred
   - `context_compactions` (number) — count of `session.compaction_start` events
   - `subagent_count` (number) — count of `subagent.started` events
   - `subagent_tokens` (number) — sum of `totalTokens` from `subagent.completed` events
   - `error_count` (number) — count of `session.error` events
   - `duration_minutes` (number) — wall-clock time from session start to last event
   - `outcome` (string) — one of: `"pushed"`, `"committed"`, `"delivered"`, `"aborted"`, `"error"`, `"no-output"`

2. **Given** a session using a non-committing skill (e.g. `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-retrospective`, `bmad-validate-prd`),
   **When** the session completes without abort or error and has at least one agent turn,
   **Then** the outcome is `"delivered"` — these skills never produce git commits by design; their output IS the review/plan/analysis itself

3. **Given** the sync daemon running in watch mode,
   **When** a session was already synced as `status: "completed"` with all outcome fields populated,
   **Then** it is skipped on subsequent polls to avoid re-parsing large files

4. **Given** the sync daemon started with `--once`,
   **When** 130+ historical sessions exist,
   **Then** all sessions are processed and the daemon exits within 30 seconds (NFR23)

5. **Given** the existing `agent-sessions.json` with sessions that have the old schema (no outcome fields),
   **When** the sync daemon runs,
   **Then** it enriches those sessions with the new fields via upsert without losing existing data

## Tasks / Subtasks

- [ ] Verify implementation against AC1: all outcome+complexity fields populated correctly (AC: 1)
  - [ ] Confirm `parseCLISession()` in `scripts/sync-sessions.mjs` handles all 11 required fields
  - [ ] Confirm `human_turns` stripping: `<skill-context>`, `<reminder>`, `<context>`, `<current_datetime>`, `<invoked_skills>`, `<userRequest>`, `<system_notification>`, `<summary>`, `<available_skills>`, `<plan_mode>` XML blocks are stripped; only count messages with >10 chars of real content remaining
  - [ ] Confirm `git commit` and `git push` detection covers bash tool calls with `toolName === "bash"` or `"shell"`

- [ ] Verify non-committing skill outcome derivation (AC: 2)
  - [ ] Confirm `NON_COMMITTING_SKILLS` set includes all skills listed in epics: `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-retrospective`, `bmad-validate-prd`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-check-implementation-readiness`, `bmad-checkpoint-preview`
  - [ ] Confirm outcome derivation order: `"aborted"` > `"error"` > `"pushed"` > `"committed"` > `"delivered"` (non-committing + agentTurns > 0) > `"no-output"`

- [ ] Verify skip-completed logic (AC: 3)
  - [ ] Confirm the guard in `syncSessions()`: skip CLI sessions where `prev?.tool === "copilot-cli" && prev?.status === "completed" && prev?.end_date && prev?.outcome`
  - [ ] Confirm old sessions without `outcome` field are NOT skipped and get re-parsed for backfill

- [ ] Validate performance requirement NFR23 (AC: 4)
  - [ ] Run `time node scripts/sync-sessions.mjs --once` with 130+ sessions in `~/.copilot/session-state/`
  - [ ] Verify completion within 30 seconds

- [ ] Verify upsert correctness for old-schema sessions (AC: 5)
  - [ ] Confirm `normalizeMergedSession({ ...(prev ?? {}), ...parsed })` preserves existing fields like `storyId`, `epicId`, `notes` from old sessions
  - [ ] Confirm old `workflow-*` sessions (non-CLI) are unaffected by CLI parsing

- [ ] Add Vitest unit tests for `parseCLISession()` logic
  - [ ] Test: session with `user.message` events — some stripped, some real — produces correct `human_turns`
  - [ ] Test: session with `tool.execution_start` bash calls with `git commit` and `git push` produces correct `git_commits`/`git_pushes`
  - [ ] Test: session with `abort` event produces `outcome: "aborted"`
  - [ ] Test: session using `bmad-code-review` skill with no git activity produces `outcome: "delivered"`
  - [ ] Test: session with `session.error` events produces correct `error_count`
  - [ ] Test: session with `subagent.started` and `subagent.completed` events produces correct `subagent_count`/`subagent_tokens`
  - [ ] Test: already-completed session with `outcome` populated is skipped in subsequent sync

- [ ] Run `cd _bmad-custom/bmad-ui && pnpm check` to verify quality gate passes

## Dev Notes

### ⚠️ Implementation Already Exists

The core implementation for this story is **pre-built** in `_bmad-custom/bmad-ui/scripts/sync-sessions.mjs`. Before writing any code, verify the current implementation covers all acceptance criteria. The primary work for this story is:

1. **Verification** — confirm all AC conditions are satisfied by the existing code
2. **Testing** — add Vitest unit tests for `parseCLISession()` since none exist
3. **Performance validation** — confirm NFR23 (30-second budget) with the real session count

### Key Implementation Location

All logic lives in `_bmad-custom/bmad-ui/scripts/sync-sessions.mjs`:

| Concern | Lines (approx) |
|---|---|
| `NON_COMMITTING_SKILLS` set | ~65–75 |
| `AUTO_INJECTED_XML_RE` regex | ~81–83 |
| `parseCLISession()` — all field extraction | ~192–345 |
| `human_turns` counter (stripping logic) | ~244–251 |
| `tool.execution_start` git detection | ~259–266 |
| `abort` / `session.error` / compaction handling | ~268–283 |
| Outcome derivation | ~302–316 |
| `syncSessions()` — skip-completed guard | ~532–539 |
| Upsert + `normalizeMergedSession` merge | ~512–517 |

### Current State of agent-sessions.json

As of story creation (2026-04-22):
- 253 CLI sessions already synced with new schema fields (`outcome`, `human_turns`, etc.)
- 160 legacy `workflow-*` sessions with old schema (`sessionId`, `skill`, `startedAt`) — these are manually-created entries not from CLI logs; the daemon does NOT re-parse these since they have no corresponding `events.jsonl`
- 359 CLI session directories exist in `~/.copilot/session-state/`

### Outcome Derivation Rules (priority order)

```
"aborted"   — abort event found
"error"     — session.error event found
"pushed"    — bash git push detected
"committed" — bash git commit detected (but no push)
"delivered" — non-committing skill + agentTurns > 0 + no abort/error
"no-output" — none of the above
```

### human_turns Filtering Logic

The `AUTO_INJECTED_XML_RE` regex strips these wrapper tags from user message content before counting:
`skill-context`, `reminder`, `context`, `current_datetime`, `invoked_skills`, `userRequest`, `system_notification`, `summary`, `available_skills`, `plan_mode`

Messages with ≤10 chars of real content remaining after stripping are NOT counted as human turns.

### Non-Committing Skills (complete set)

```js
"bmad-code-review", "bmad-sprint-planning", "bmad-sprint-status",
"bmad-retrospective", "bmad-validate-prd", "bmad-review-adversarial-general",
"bmad-review-edge-case-hunter", "bmad-check-implementation-readiness",
"bmad-checkpoint-preview"
```

### Project Structure Notes

- Sync daemon: `_bmad-custom/bmad-ui/scripts/sync-sessions.mjs` (ES module, Node ≥ 24)
- Sessions file: `_bmad-custom/agents/agent-sessions.json`
- Test file (to create): colocate as `_bmad-custom/bmad-ui/scripts/sync-sessions.test.mjs` or `src/lib/sync-sessions.test.ts` if logic is extracted — prefer Vitest in `scripts/` directory
- `pnpm check` from `_bmad-custom/bmad-ui/` runs lint + types + tests + build

### Testing Notes

- No unit tests exist for `sync-sessions.mjs` — this is the most important gap to fill
- Use Vitest: `import { describe, it, expect } from "vitest"`
- The parsing functions operate on raw JSONL strings — mock file I/O by calling the parse functions directly with synthetic JSONL content
- To test `parseCLISession()` directly, you need to either export it or test via a helper that wraps the file parsing

### NFR23 Performance Requirement

- Daemon must process all 130+ historical sessions within 30 seconds using `--once` mode
- Current implementation is synchronous (blocking I/O) — with 359 sessions, verify this completes in time
- If performance is insufficient, consider batching or async file reads

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] — acceptance criteria, FR41, FR44, NFR23, NFR24
- [Source: _bmad-output/planning-artifacts/epics.md#NFR23] — 30-second processing budget
- [Source: _bmad-output/planning-artifacts/epics.md#NFR24] — metrics must derive from local logs only (no network)
- [Source: _bmad-custom/bmad-ui/scripts/sync-sessions.mjs] — existing implementation to verify
- [Source: _bmad-custom/agents/agent-sessions.json] — target file with 413 current sessions
- [Source: _bmad-output/project-context.md] — TypeScript/Biome rules, test standards

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Story created 2026-04-22: core implementation pre-built in sync-sessions.mjs
- Primary dev work: add Vitest unit tests for parseCLISession() and verify all ACs against existing code
- 253 CLI sessions already enriched; 160 legacy workflow-* sessions use old schema and are not re-processed by daemon
- Performance validation (NFR23) required before story can be closed

### File List
