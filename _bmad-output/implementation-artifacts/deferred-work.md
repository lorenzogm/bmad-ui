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
