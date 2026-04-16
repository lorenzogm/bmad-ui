## Deferred from: code review of 3-1-establish-root-level-dotenvx-secret-workflow (2026-04-15)

- Potential shell injection risk when exporting dotenvx values into `$GITHUB_ENV` in `.github/workflows/deploy.yml` during deploy secret handoff.
- Terraform state decryption failure path can continue with empty state and apply drift in `.github/workflows/deploy.yml`.

Resolution (2026-04-16): both items were implemented and closed in `.github/workflows/deploy.yml`.
