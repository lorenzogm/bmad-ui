---
storyId: '3-1'
storyTitle: 'Establish Root-Level dotenvx Secret Workflow'
epicId: '3'
epicTitle: 'Secrets & Environment Management'
status: review
created: '2026-04-15'
priority: high
---

# Story 3.1: Establish Root-Level dotenvx Secret Workflow

Status: review

## Story

As a maintainer,
I want a standardized dotenvx workflow at repository root,
So that all environments use a consistent encrypted secrets process.

## Acceptance Criteria

1. **Given** the repository root, **when** checked, **then** `dotenvx` config and encrypted env files are present and documented for local and CI usage
2. **Given** a maintainer onboarding flow, **when** followed, **then** required steps to encrypt, decrypt, and load environment variables are explicit and reproducible
3. **Given** secret files in git, **when** reviewed, **then** only encrypted secret artifacts are tracked and plaintext secret files are excluded

## Tasks / Subtasks

- [x] Verify and harden `.gitignore` for plaintext secret files (AC: #3)
  - [x] Confirm `.env.keys` is excluded (already present)
  - [x] Add `.env.local`, `.env.*.local`, `.env.production`, `.env.development` exclusions to prevent accidental plaintext commits
  - [x] Verify no plaintext secrets appear in `git ls-files` output
- [x] Create `docs/secrets-workflow.md` — definitive dotenvx guide for maintainers (AC: #1, #2)
  - [x] Overview: encryption model, what gets committed vs. never committed
  - [x] Prerequisites section: install dotenvx (v1.61.0+)
  - [x] Local usage: `dotenvx run -- <command>`, reading decrypted values
  - [x] Adding a new secret: `dotenvx set KEY value` and how it updates `.env`
  - [x] Rotating a secret: update `.env`, update GitHub Secret `DOTENV_PRIVATE_KEY`
  - [x] CI usage: how `DOTENV_PRIVATE_KEY` GitHub Secret enables decryption in workflows
  - [x] Secrets inventory: current keys stored in `.env` and their purpose
- [x] Update `CONTRIBUTING.md` to reference the secrets workflow (AC: #1)
  - [x] Add "Secrets & Environment" section pointing to `docs/secrets-workflow.md`
  - [x] Clarify contributors do NOT need production secret access for normal dev (preview of Story 3.2)
- [x] Update root `README.md` prerequisites section (AC: #1)
  - [x] Add note that maintainer setup requires dotenvx installed locally
  - [x] Link to `docs/secrets-workflow.md` for full workflow details

## Dev Notes

### What Already Exists (Do Not Reinvent)

Story 2-2 established the functional dotenvx setup:
- `.env` at repo root — encrypted with `DOTENV_PUBLIC_KEY` using X25519+AES-256-GCM; safe to commit
- `.env.keys` at repo root — contains `DOTENV_PRIVATE_KEY`; already excluded from git via `.gitignore`
- `.gitignore` has: `# dotenvx — commit encrypted .env, never commit decryption keys` + `.env.keys`
- GitHub Actions (`deploy.yml`) loads secrets via: `pnpm dlx @dotenvx/dotenvx run -- sh -c '...'` with `DOTENV_PRIVATE_KEY` env var set from `${{ secrets.DOTENV_PRIVATE_KEY }}`

**DO NOT re-implement the encryption setup** — it's already working. This story documents and hardens it.

### Current Secrets Inventory

| Key | Purpose | Set By |
|-----|---------|--------|
| `DOTENV_PUBLIC_KEY` | dotenvx public key for this repo | dotenvx (auto) |
| `TF_VAR_GH_PAT_TOKEN` | GitHub PAT for Terraform GitHub provider | Maintainer |
| `TF_VAR_GITHUB_OWNER` | GitHub org/user for Terraform | Maintainer |
| `TERRAFORM_STATE_ENCRYPT_KEY` | AES key for encrypting Terraform state | Maintainer |
| `VERCEL_ORG_ID` | Vercel organization ID | Maintainer |
| `VERCEL_TOKEN` | Vercel API token | Maintainer |

Also stored as plain GitHub Secrets (not in `.env`):
- `DOTENV_PRIVATE_KEY` — the decryption key, used to decrypt `.env` in CI
- `TERRAFORM_STATE_ENCRYPT_KEY` — also a plain GitHub Secret (needed before dotenvx runs)

### dotenvx Encryption Model

```
.env (committed)
├── DOTENV_PUBLIC_KEY="03bbdc..."  ← public key, safe to commit
└── KEY="encrypted:BIHc+..."       ← values encrypted with public key

.env.keys (NEVER committed — in .gitignore)
└── DOTENV_PRIVATE_KEY="d7ad2d..."  ← decrypts all keys
```

**Local usage**: dotenvx reads `.env.keys` automatically from disk.
**CI usage**: `DOTENV_PRIVATE_KEY` env var is set from GitHub Secret; dotenvx uses it instead of `.env.keys`.

### Key dotenvx Commands

```bash
# Install (one-time, system-wide)
npm install -g @dotenvx/dotenvx   # or: brew install dotenvx

# Run any command with decrypted secrets
dotenvx run -- pnpm dev
dotenvx run -- terraform plan

# Add or update a secret
dotenvx set VERCEL_TOKEN "my-token"   # encrypts & writes to .env

# Verify decryption works
dotenvx run -- env | grep VERCEL_TOKEN

# Inspect public key (safe to share)
grep DOTENV_PUBLIC_KEY .env
```

### .gitignore Additions Needed

Current `.gitignore` only has `.env.keys`. Add defensively:

```gitignore
# dotenvx — commit encrypted .env, never commit decryption keys
.env.keys
# Prevent accidental plaintext env file commits
.env.local
.env.*.local
.env.production
.env.development
```

Note: `.env` itself **is** committed (it contains encrypted values, not plaintext). Only `.env.keys` and plaintext variants must be excluded.

### File Locations

| File | Action |
|------|--------|
| `.gitignore` | Update — add `.env.local`, `.env.*.local`, etc. |
| `docs/secrets-workflow.md` | Create — new comprehensive guide |
| `.github/CONTRIBUTING.md` | Update — add Secrets & Environment section |
| `README.md` | Update — add maintainer prerequisites note |

No changes to `.env`, `.env.keys`, or any workflow files in this story.

### Architecture Compliance

From `architecture.md`:
- **NFR5**: Secrets are never committed in plaintext to version control
- **NFR6**: Secret values are managed through dotenvx workflow with environment separation for development and production
- **Security controls**: dotenvx-based encrypted environment workflow (already implemented; this story documents it)

### Git Intelligence

Recent commits that show the dotenvx evolution:
- `e888b81` — fix(ci): encrypt VERCEL_TOKEN/VERCEL_ORG_ID in .env, restore dotenvx loading
- `1b15162` — fix(ci): rename workflow to bmad-ui-deploy, use plain GitHub secrets for Vercel
- `09bd6b8` — feat(infra): add GitHub Actions deploy pipeline and Vercel Terraform module

The fix at `e888b81` moved from plain GitHub secrets for Vercel to dotenvx-managed secrets. Story 3-1 should document the final settled approach from that commit.

### Project Structure Notes

- `docs/secrets-workflow.md` — place in `docs/` (alongside `deployment-guide.md`, `development-guide-bmad-ui.md`)
- `.github/CONTRIBUTING.md` — already exists; add a "Secrets & Environment" section
- `README.md` — at repo root; update Prerequisites/Getting Started section
- No changes to `_bmad-custom/bmad-ui/` source code needed

### Cross-Story Context

- **Story 3.2** (next): Contributors need dev-only secrets without production access — the documentation created in this story will be the foundation for what Story 3.2 splits into "maintainer" vs. "contributor" sections
- **Story 2.2** (previous): Established the functional dotenvx workflow; this story formalizes it
- **Story 2.3** (cancelled): Environment separation was scope-reduced; current `deploy.yml` handles env via `workflow_dispatch`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] — acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — NFR5, NFR6, dotenvx decision
- [Source: _bmad-output/implementation-artifacts/2-2-github-actions-deployment-pipeline.md#Secrets Model] — existing setup
- [Source: .gitignore] — current dotenvx exclusions
- [Source: .env] — encrypted secrets format (DOTENV_PUBLIC_KEY + encrypted values)
- [Source: .github/workflows/deploy.yml] — CI dotenvx pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Hardened `.gitignore` with four additional plaintext env file exclusions
- Created `docs/secrets-workflow.md` with full encryption model, prerequisites, local/CI usage, secrets inventory, adding/rotating secrets, and onboarding steps
- Updated `.github/CONTRIBUTING.md` with a new "Secrets & Environment" section clarifying maintainer vs. contributor access
- Updated `README.md` prerequisites to note dotenvx requirement for maintainers with link to workflow doc
- Verified `git ls-files | grep .env` returns only `.env` (the encrypted file) — no plaintext secrets tracked

### File List

- `.gitignore` — added `.env.local`, `.env.*.local`, `.env.production`, `.env.development` exclusions
- `docs/secrets-workflow.md` — created comprehensive dotenvx guide
- `.github/CONTRIBUTING.md` — added Secrets & Environment section
- `README.md` — updated prerequisites with dotenvx maintainer note and link
