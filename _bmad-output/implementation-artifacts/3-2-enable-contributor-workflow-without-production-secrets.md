---
storyId: '3-2'
storyTitle: 'Enable Contributor Workflow Without Production Secrets'
epicId: '3'
epicTitle: 'Secrets & Environment Management'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 3.2: Enable Contributor Workflow Without Production Secrets

Status: ready-for-dev

## Story

As a contributor,
I want to run and validate the project without production secret access,
so that I can contribute safely without privileged credentials.

## Acceptance Criteria

1. **Given** a contributor setup, **when** running locally, **then** no secrets or credentials are required to start and validate core workflows (`pnpm dev`, `pnpm run check`, `pnpm build`)
2. **Given** missing production values, **when** contributor commands run, **then** they fail gracefully only where production access is required (infra/deploy commands) and include clear guidance
3. **Given** contributor docs, **when** read, **then** they clearly state that all secrets are infrastructure-only (Terraform, Vercel, CI/CD) and the app itself has no secret dependencies

## Tasks / Subtasks

- [ ] Create `.env.example` at repository root documenting all env variables (AC: #3)
  - [ ] Include all keys from `.env` (`DOTENV_PUBLIC_KEY`, `TF_VAR_GH_PAT_TOKEN`, `TF_VAR_GITHUB_OWNER`, `TERRAFORM_STATE_ENCRYPT_KEY`, `VERCEL_ORG_ID`, `VERCEL_TOKEN`)
  - [ ] Use placeholder values (e.g. `ask-a-maintainer`) — never real secrets
  - [ ] Add inline comments making clear all variables are infra/deploy-only — **not needed by contributors**
- [ ] Update `.github/CONTRIBUTING.md` with a "Secrets & Credentials" section (AC: #3)
  - [ ] Lead with the key message: **no secrets are needed to run or develop the app**
  - [ ] Explain that all secrets in `.env` are infrastructure-only (Terraform, Vercel, CI/CD) and held by maintainers
  - [ ] Point to `.env.example` as reference for what those variables are
- [ ] Update `docs/development-guide-bmad-ui.md` to state zero-secret requirement explicitly (AC: #1)
  - [ ] Make it the first thing a contributor reads: no `.env` setup required
  - [ ] Note that `infra/` and deploy workflows are maintainer-only
- [ ] Verify graceful failure for production-gated commands (AC: #2)
  - [ ] Confirm `dotenvx run` fails with a clear message when `DOTENV_PRIVATE_KEY` is absent
  - [ ] Document the expected error so contributors know they've hit a maintainer-only boundary
- [ ] Update sprint-status.yaml to `ready-for-dev` (done automatically)

## Dev Notes

### Current Secret Landscape

The repository uses dotenvx for encrypted secrets. The `.env` at repo root contains **encrypted values only** — never plaintext secrets. The decryption key (`DOTENV_PRIVATE_KEY`) is in `.env.keys`, which is gitignored.

Encrypted variables currently in `.env`:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `DOTENV_PUBLIC_KEY` | Public | dotenvx encryption public key — safe to commit |
| `TF_VAR_GH_PAT_TOKEN` | **Production** | GitHub PAT for Terraform GitHub provider |
| `TF_VAR_GITHUB_OWNER` | **Production** | GitHub org/user for Terraform |
| `TERRAFORM_STATE_ENCRYPT_KEY` | **Production** | Encrypts Terraform state in `terraform-state` branch |
| `VERCEL_ORG_ID` | **Production** | Vercel org for deployment |
| `VERCEL_TOKEN` | **Production** | Vercel API token for deployment |

**Key insight:** Every secret in `.env` is infra/deploy-only. The app has **zero secret dependencies** at any level — dev, test, build, or preview. `pnpm dev`, `pnpm build`, and `pnpm run check` inside `_bmad-custom/bmad-ui/` require no `.env`, no credentials, nothing. Secrets are consumed exclusively by:
- `.github/workflows/deploy.yml` (CI/CD pipeline — maintainers only)
- `infra/*/src/` Terraform modules (maintainers only)

### `.env.example` Requirements

Create `/path/.env.example` at repo root following the same structure as `.env`:

```dotenv
#/-------------------[DOTENV_PUBLIC_KEY]--------------------/
#/            public-key encryption for .env files          /
#/       [how it works](https://dotenvx.com/encryption)     /
#/----------------------------------------------------------/
DOTENV_PUBLIC_KEY="<maintainer-provides-public-key>"

# NOTE FOR CONTRIBUTORS:
# You do NOT need any of these values to run or develop the app.
# `pnpm dev`, `pnpm run check`, and `pnpm build` work with zero secrets.
#
# All variables below are infrastructure-only (Terraform + Vercel + CI/CD).
# They are held exclusively by maintainers. Do not ask contributors to set these.

# --- PRODUCTION SECRETS (maintainer-only) ---
# These values are held by maintainers and stored as GitHub Secrets.
# Contributors must NOT set these locally. Contact a maintainer for access.

# GitHub PAT for Terraform (infra/github/src/)
TF_VAR_GH_PAT_TOKEN="ask-a-maintainer"

# GitHub owner for Terraform
TF_VAR_GITHUB_OWNER="ask-a-maintainer"

# Terraform state encryption key (infra/github and infra/vercel workflows)
TERRAFORM_STATE_ENCRYPT_KEY="ask-a-maintainer"

# Vercel org ID for deployment (deploy.yml workflow)
VERCEL_ORG_ID="ask-a-maintainer"

# Vercel API token for deployment (deploy.yml workflow)
VERCEL_TOKEN="ask-a-maintainer"
```

Do **not** include actual values. `.env.example` is committed and public-facing.

### CONTRIBUTING.md Secrets Section

Add a new "Secrets & Credentials" section to `.github/CONTRIBUTING.md`. Insert it between the existing "Development Workflow" section and "Code Quality":

```markdown
## Secrets & Credentials

**Good news: frontend development requires no secrets.**

The following commands work immediately after `pnpm install` — no environment variables needed:

```bash
cd _bmad-custom/bmad-ui
pnpm dev           # Start dev server
pnpm run check     # Lint + typecheck + tests + build
pnpm run build     # Production build
```

### What Requires Production Secrets

The following workflows require credentials held only by maintainers:

| Task | Command / Tool | Who Can Run |
|------|---------------|-------------|
| Deploy to Vercel | `.github/workflows/deploy.yml` | Maintainers only |
| Provision infrastructure | `infra/github/src/`, `infra/vercel/src/` | Maintainers only |
| Decrypt `.env` values | `dotenvx run --` | Maintainers with `DOTENV_PRIVATE_KEY` |

### For Contributors

- See `.env.example` for the full list of environment variables and their purpose
- Do **not** add plaintext secret values to `.env`, `.env.local`, or any tracked file
- If a workflow fails with a `DOTENV_PRIVATE_KEY` error, that workflow requires maintainer access
- Open a [GitHub Discussion](https://github.com/lorenzogm/bmad-ui/discussions) if you need help

### For Maintainers

- The decryption key lives in `.env.keys` (gitignored)
- Production secrets are encrypted in `.env` using dotenvx public-key encryption
- GitHub Secrets (`DOTENV_PRIVATE_KEY`, `TERRAFORM_STATE_ENCRYPT_KEY`) power the CI/CD pipeline
```

### Story 3-1 Dependency Note

Story 3-1 (Establish Root-Level dotenvx Secret Workflow) is the canonical setup for the dotenvx encryption workflow. Story 3-2 depends on the output of 3-1 — specifically, the encrypted `.env` at root and the `.env.keys` gitignore rule. At the time of this story's creation, dotenvx is already operationally set up (`.env` and `.env.keys` both exist; `.env.keys` is gitignored). Story 3-2 builds on that by making the contributor-facing story explicit and documented.

If 3-1 has not been completed, verify these preconditions before implementing 3-2:
- `.env` exists at repo root with encrypted values
- `.env.keys` is in `.gitignore`
- `dotenvx` is available via `pnpm dlx @dotenvx/dotenvx`

All three are already true in the current repo state.

### Graceful Failure Verification

When a contributor without `DOTENV_PRIVATE_KEY` runs a dotenvx-gated command, the expected error is:

```
[dotenvx@x.x.x] MISSING_PRIVATE_KEY: missing private key for encrypted variable(s): [...]
```

This is an informative error. The story's acceptance criterion is met if:
1. The contributor-facing commands (`pnpm dev`, `pnpm run check`) never invoke dotenvx — so no failure
2. The deploy/infra commands fail with the above dotenvx message — clear enough

No additional error-handling code is needed. The documentation work is the deliverable.

### Files to Create or Modify

| File | Action | Purpose |
|------|--------|---------|
| `.env.example` | Create | Document all env variables with placeholder values and comments |
| `.github/CONTRIBUTING.md` | Update | Add "Secrets & Credentials" section |
| `docs/development-guide-bmad-ui.md` | Update | Clarify zero-secret local dev workflow |

### Project Structure Notes

- `.env.example` must be at **repository root** (same level as `.env`) — not inside `_bmad-custom/bmad-ui/`
- `.env.example` is conventionally committed to source control (not gitignored)
- Confirm `.gitignore` does not accidentally exclude `.env.example` (currently only `.env.keys` is excluded)
- CONTRIBUTING.md lives at `.github/CONTRIBUTING.md` (already exists from Story 1-4)
- Development guide lives at `docs/development-guide-bmad-ui.md` (already exists)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] — acceptance criteria and FR12 mapping
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — dotenvx security model
- [Source: _bmad-output/implementation-artifacts/2-2-github-actions-deployment-pipeline.md#Secrets Model] — secrets table and dotenvx pattern
- [Source: .env] — current encrypted env structure (keys visible, values encrypted)
- [Source: .gitignore] — `.env.keys` gitignore rule
- [Source: .github/CONTRIBUTING.md] — existing contribution guide to extend
- [Source: docs/development-guide-bmad-ui.md] — existing dev guide to extend

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
