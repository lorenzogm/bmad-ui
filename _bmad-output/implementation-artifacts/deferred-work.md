## Deferred from: code review of 3-1-establish-root-level-dotenvx-secret-workflow (2026-04-15)

- Potential shell injection risk when exporting dotenvx values into `$GITHUB_ENV` in `.github/workflows/deploy.yml` during deploy secret handoff.
- Terraform state decryption failure path can continue with empty state and apply drift in `.github/workflows/deploy.yml`.

Resolution (2026-04-16): both items were implemented and closed in `.github/workflows/deploy.yml`.

## Deferred from: new-chat-sidebar-flyout one-shot (2026-04-16)

- Focus management for the New Chat flyout: when opened, focus should move to the skill input; when closed, focus should return to the trigger button. Needs a ref + focus approach compatible with project rules (no `useEffect` for side effects — may need a callback ref or onTransitionEnd pattern).

## Deferred from: persist-orchestration-state one-shot (2026-04-16)

- Add TTL/expiry to localStorage orchestrating flag so stale state from abandoned sessions auto-clears.
- Multi-tab orchestration deduplication: multiple tabs on the same epic can both enter the orchestration driver and fire duplicate API calls.
- Cross-tab `storage` event listener to sync orchestrating state when changed from another tab or DevTools.
- Garbage collection for zombie localStorage keys from abandoned navigations (e.g. `bmad-orchestrating:epic-X` left behind if user never returns).
- Store richer metadata in localStorage (JSON object with `startedAt`, `epicId`) instead of bare `"true"` string, enabling TTL checks and debugging.

## Deferred from: code review of 5-1-create-npx-bmad-method-ui-install-cli (2026-04-18)

- No `--access public` flag on `npm publish` (.github/workflows/publish.yml:34) — unscoped package defaults to public, low risk; revisit if package is ever renamed to a scoped name
- Non-TTY stdin causes silent abort on overwrite guard (bin/install.mjs:19) — behavior is safe (empty input defaults to N = abort), but may confuse automation; revisit if CI install use-cases emerge

## Deferred from: code review of 8-3-validate-self-referential-delivery-loop (2026-04-21)

- Story 8.3 prerequisites are not yet satisfied (`8-1` is `in-progress`, `8-2` is `review` in sprint status), so acceptance validation must remain blocked until dependency stories are done.
- Required 8.3 deliverable updates in `docs/phase-1-completion.md` are not part of the reviewed changeset, so AC #2/#3 traceability closure is deferred until story implementation work is completed.

## Deferred from: code review of 9-4-responsive-layout-and-spacing-refinements (2026-04-22)

- Story scope drift in `_bmad-ui/src/app.tsx` (StatusBadge + status mapping refactor added in a layout-spacing story) retained as pre-existing because it is now part of the baseline flow.
- Status copy semantics in `_bmad-ui/src/app.tsx` changed beyond this story's CSS/layout scope (`backlog` → `To Do`, `review` → `In Review`) and is deferred for a dedicated status-language alignment pass.

## Deferred from: code review of 9-6-sidebar-running-sessions-panel (2026-04-22)

- Story 9.6 implementation commit (`ffbb311`) expanded beyond the planned single-file scope in the story notes. Deferred as process/history-only because the commit is already integrated and no code-safety action is required.

## Deferred from: code review of 9-3-status-badge-consistency-across-views (2026-04-22)

- Story markdown status regex is brittle to markdown formatting variation (`_bmad-ui/scripts/agent-server.ts:384`) and can skip status overrides unexpectedly.
- Story status synchronization only updates when the incoming markdown status has a different order rank (`_bmad-ui/scripts/agent-server.ts:1284`), which can block intentional regressions for resets/reopens.
- Story discovery silently returns when reading implementation-artifact directories fails (`_bmad-ui/scripts/agent-server.ts:1328`), obscuring operational failures.
- Story detail step-state fallback can diverge from story-level status when no active review session exists (`_bmad-ui/scripts/agent-server.ts:4587`).

## Deferred from: UI fixes batch plan (2026-04-23)

- **Spec B — Docs browser fix:** ~~Docs listing page shows wrong docs (hardcoded `KNOWN_DOCS` catalog in `src/lib/docs-catalog.ts` doesn't match actual `docs/` folder contents); docs detail page fetches wrong content. Root cause: stale 4-entry catalog vs 17+ real doc files.~~ Resolved: replaced hardcoded catalog with dynamic API-driven docs listing (`/api/docs` endpoint + static data plugin).
- **Spec C — Sprint board:** ~~Transform `/develop-deliver` from a simple epics progress list into a Jira-like backlog board view showing story status columns (To Do, In Progress, In Review, Done) per sprint.~~ Resolved: added `/board` route with Kanban-style sprint board and "Board" nav link in sidebar.

## Deferred from: code review of spec-homepage-dd-epic-fixes (2026-04-23)

- Epic 13 entry in `epics.md` omits `**FRs reinforced:**` and `**NFRs reinforced:**` cross-references that all other epics include. Add FR/NFR mapping when epic 13 stories are formally planned.
