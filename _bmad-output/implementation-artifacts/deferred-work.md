## Deferred from: code review of 3-1-establish-root-level-dotenvx-secret-workflow (2026-04-15)

- Potential shell injection risk when exporting dotenvx values into `$GITHUB_ENV` in `.github/workflows/deploy.yml` during deploy secret handoff.
- Terraform state decryption failure path can continue with empty state and apply drift in `.github/workflows/deploy.yml`.

Resolution (2026-04-16): both items were implemented and closed in `.github/workflows/deploy.yml`.

## Deferred from: new-chat-sidebar-flyout one-shot (2026-04-16)

- Focus management for the New Chat flyout: when opened, focus should move to the skill input; when closed, focus should return to the trigger button. Needs a ref + focus approach compatible with project rules (no `useEffect` for side effects — may need a callback ref or onTransitionEnd pattern).
