# Story 3.3: Secret Rotation and Audit-Safe Handling

Status: in-progress

## Story

As a maintainer,
I want to rotate secrets and verify they are never exposed in source or logs,
So that credential hygiene remains strong over time.

## Acceptance Criteria

1. **Given** a secret rotation event, **When** values are updated, **Then** deployment and CI pipelines continue operating after updating encrypted sources and GitHub Secrets

2. **Given** CI workflow runs, **When** logs are inspected, **Then** secret values are masked and not echoed in any step output

3. **Given** repository history and configuration review, **When** scanned, **Then** no plaintext secrets are present in tracked files

4. **Given** the operations runbook, **When** consulted, **Then** rotation and rollback procedures are documented with reproducible steps

## Tasks / Subtasks

- [x] Task 1: Fix CI log masking for dotenvx-decrypted secrets (AC: #2)
  - [x] Audit `deploy.yml` for every step that writes a decrypted secret to `$GITHUB_ENV` or uses it in a shell expression
  - [x] Add `echo "::add-mask::$VALUE"` before each `echo "KEY=$VALUE" >> "$GITHUB_ENV"` write for `VERCEL_TOKEN` and `VERCEL_ORG_ID` (these are decrypted by dotenvx and are not auto-masked by GitHub Actions)
  - [x] Verify `TERRAFORM_STATE_ENCRYPT_KEY` (a direct GitHub Secret) is already auto-masked since it comes from `${{ secrets.TERRAFORM_STATE_ENCRYPT_KEY }}`
  - [x] Verify `DOTENV_PRIVATE_KEY` (a direct GitHub Secret) is auto-masked
  - [x] Confirm no `set -x` or `run: env` debug commands are present in the workflow

- [x] Task 2: Run plaintext-secret audit scan (AC: #3)
  - [x] Confirm `.env.keys` is in `.gitignore` and has never been tracked: `git ls-files --cached .env.keys` (must return empty)
  - [x] Scan all tracked files for patterns matching `DOTENV_PRIVATE_KEY_*=`, `TF_VAR_GH_PAT_TOKEN=`, raw token-like strings using `git grep -i "private_key\s*=\s*[^e]"` — any hit that is NOT prefixed `encrypted:` is a plaintext leak
  - [x] Confirm the committed `.env` file contains only `encrypted:...` values (no plaintext), verifiable with `grep -v "encrypted:" .env | grep "="` returning only `DOTENV_PUBLIC_KEY=`
  - [x] Run `git log --all --full-history -- '.env.keys'` to verify the file has never been committed
  - [x] Document audit results in the runbook

- [x] Task 3: Create secret rotation runbook (AC: #1, #4)
  - [x] Create `docs/secret-rotation.md` with the full rotation procedure (see Dev Notes for required sections)
  - [x] Document dotenvx re-encryption steps for updating a secret value
  - [x] Document how to update the `DOTENV_PRIVATE_KEY` GitHub Secret when the encryption key changes
  - [x] Document how to update `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret
  - [x] Verify pipeline continues working after rotation by documenting test steps

- [x] Task 4: Document rollback procedure (AC: #4)
  - [x] Add rollback section to `docs/secret-rotation.md`
  - [x] Describe reverting encrypted `.env` via `git revert` or `git checkout <sha> -- .env`
  - [x] Describe restoring previous GitHub Secret values
  - [x] Describe re-running deploy workflow to confirm system recovery

### Review Findings

- [ ] [Review][Patch] Avoid printing `DOTENV_PRIVATE_KEY` to terminal output in rotation steps [`docs/secret-rotation.md:87`]
- [ ] [Review][Patch] Avoid writing decrypted Terraform state artifacts to shared `/tmp` paths during rotation [`docs/secret-rotation.md:134`]
- [ ] [Review][Patch] Include explicit production-state re-encryption and commit steps in Terraform key rotation procedure [`docs/secret-rotation.md:146`]
- [ ] [Review][Patch] Replace `git revert HEAD` rollback guidance with targeted commit rollback for `terraform-state` [`docs/secret-rotation.md:251`]

## Dev Notes

### Current Secret Architecture

The repo uses a two-layer secret model:

**Layer 1 — dotenvx encrypted `.env` (committed to `main`)**
- File: `.env` at repo root
- Contains encrypted ciphertext for: `TF_VAR_GH_PAT_TOKEN`, `TF_VAR_GITHUB_OWNER`, `TERRAFORM_STATE_ENCRYPT_KEY`, `VERCEL_ORG_ID`, `VERCEL_TOKEN`
- The `DOTENV_PUBLIC_KEY` (encryption public key) is safe to commit — it's in `.env`
- Decryption key (`.env.keys`) is in `.gitignore` — never committed

**Layer 2 — GitHub Secrets (two root secrets)**
- `DOTENV_PRIVATE_KEY` — decrypts the `.env` file at CI runtime (referenced in all deploy jobs)
- `TERRAFORM_STATE_ENCRYPT_KEY` — decrypts the encrypted Terraform state file stored in the `terraform-state` branch

**CI Decryption flow (`deploy.yml`):**
1. Job env sets `DOTENV_PRIVATE_KEY: ${{ secrets.DOTENV_PRIVATE_KEY }}`
2. Step: `pnpm dlx @dotenvx/dotenvx run -- sh -c 'echo "TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN" >> "$GITHUB_ENV"'`
3. This decrypts `VERCEL_TOKEN` from `.env` and writes the plaintext value to `$GITHUB_ENV`

### Critical Gap: Masking Dotenvx-Decrypted Secrets

**GitHub Actions auto-masks `${{ secrets.* }}` values**, but does NOT auto-mask values decrypted at runtime by dotenvx. When `pnpm dlx @dotenvx/dotenvx run -- sh -c 'echo "TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN" >> "$GITHUB_ENV"'` writes a value, that plaintext value is NOT masked in subsequent step logs.

**Fix:** Add `::add-mask::` commands in every step that exposes a dotenvx-decrypted value. Example pattern:

```yaml
- name: Load secrets from encrypted .env
  run: |
    pnpm dlx @dotenvx/dotenvx run -- sh -c '
      echo "::add-mask::$VERCEL_TOKEN"
      echo "::add-mask::$VERCEL_ORG_ID"
      echo "TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN" >> "$GITHUB_ENV"
      echo "TF_VAR_VERCEL_ORG_ID=$VERCEL_ORG_ID" >> "$GITHUB_ENV"
    '
```

Apply this pattern everywhere in `deploy.yml` that decrypted secrets are written to `$GITHUB_ENV` — there are at least three locations (lines ~115, ~268, ~343).

### Secret Rotation Runbook Content Requirements

The file `docs/secret-rotation.md` must cover:

1. **Overview** — the two-layer model (dotenvx + GitHub Secrets)
2. **Rotating application secrets** (e.g., `VERCEL_TOKEN`, `TF_VAR_GH_PAT_TOKEN`):
   - Obtain new value
   - Run: `dotenvx set KEY=newvalue` (re-encrypts with existing public key, updates `.env`)
   - Commit and push the updated `.env`
   - No GitHub Secret change required (only `.env` content changes)
3. **Rotating the dotenvx encryption key** (full key rotation):
   - Run: `dotenvx genkeys` to create a new key pair (updates `.env.keys` and `.env`)
   - Update `DOTENV_PRIVATE_KEY` GitHub Secret with the new private key value from `.env.keys`
   - Commit and push the updated `.env`
4. **Rotating `TERRAFORM_STATE_ENCRYPT_KEY`**:
   - Generate new AES-256 key: `openssl rand -hex 32`
   - Re-encrypt existing Terraform state: decrypt old state, re-encrypt with new key
   - Push re-encrypted state to `terraform-state` branch
   - Update `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret
5. **Verification steps** — trigger a `workflow_dispatch` on `deploy.yml` and verify all jobs succeed
6. **Rollback procedure** — revert `.env` git commit + restore previous GitHub Secret values

### File Locations

| File | Purpose |
|------|---------|
| `.env` | Committed encrypted secrets (update when rotating values) |
| `.env.keys` | Private decryption key — NEVER commit, managed locally |
| `.gitignore` | Must contain `.env.keys` — do not remove |
| `.github/workflows/deploy.yml` | CI workflow — add `::add-mask::` for decrypted values |
| `docs/secret-rotation.md` | New runbook — create this file |

### Audit Scan Commands

```bash
# Verify .env.keys has never been committed
git ls-files --cached .env.keys  # must be empty

# Check .env has no plaintext values (only encrypted: prefix or public key)
grep "=" .env | grep -v "encrypted:\|DOTENV_PUBLIC_KEY"  # must be empty

# Scan all tracked files for private key patterns
git grep -i "private_key\s*=" -- ':!.env.keys'  # only .env.keys should match (not tracked)

# Check git history hasn't contained .env.keys
git log --all --full-history -- '.env.keys'  # must be empty
```

### Project Structure Notes

- This story touches CI workflow (`deploy.yml`) and adds a new doc (`docs/secret-rotation.md`)
- No frontend code changes (React/TypeScript/Vite) — this is pure ops/CI/documentation work
- Do NOT touch `_bmad-custom/bmad-ui/` — this story is infrastructure-layer only
- `docs/` is the established location for operational guides (`docs/index.md`, `docs/project-overview.md`, etc.)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — Acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md] — FR14: rotate secrets without redefining capabilities; FR15: validate sensitive values excluded from source artifacts; NFR6: dotenvx with environment separation; NFR9: sensitive operations auditable through repo and workflow history
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication--Security] — Security controls: dotenvx-based encrypted environment workflow, auditability through CI history
- [Source: .github/workflows/deploy.yml] — Current CI implementation with DOTENV_PRIVATE_KEY and TERRAFORM_STATE_ENCRYPT_KEY as GitHub Secrets; dotenvx decrypted values written to $GITHUB_ENV without masking
- [Source: .env] — Encrypted values: TF_VAR_GH_PAT_TOKEN, TF_VAR_GITHUB_OWNER, TERRAFORM_STATE_ENCRYPT_KEY, VERCEL_ORG_ID, VERCEL_TOKEN
- [Source: .gitignore] — `.env.keys` correctly excluded from tracking
- [Source: commit e888b81] — fix(ci): encrypt VERCEL_TOKEN/VERCEL_ORG_ID in .env, restore dotenvx loading

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

None — implementation was straightforward with no blockers.

### Completion Notes List

- Added `::add-mask::` commands for `VERCEL_TOKEN` and `VERCEL_ORG_ID` in all 3 job locations in `deploy.yml` (infra-deploy, deploy-preview, deploy-production). Masks are issued inside the dotenvx run context where decryption occurs, before values are written to `$GITHUB_ENV`.
- Confirmed `DOTENV_PRIVATE_KEY` and `TERRAFORM_STATE_ENCRYPT_KEY` are auto-masked by GitHub Actions (they are direct `${{ secrets.* }}` references).
- All audit checks passed: `.env.keys` never committed, `.env` contains only encrypted values, no debug commands in workflow.
- Created comprehensive `docs/secret-rotation.md` covering all rotation scenarios and rollback procedures.
- Updated `docs/index.md` to reference new Operations & Security section.

### File List

- `.github/workflows/deploy.yml` — added `::add-mask::` for VERCEL_TOKEN and VERCEL_ORG_ID in 3 locations
- `docs/secret-rotation.md` — new secret rotation and rollback runbook
- `docs/index.md` — added Operations & Security section with links

## Change Log

- **2026-04-16**: Story 3.3 implementation
  - Fixed CI log masking gap: dotenvx-decrypted secrets (VERCEL_TOKEN, VERCEL_ORG_ID) were not auto-masked by GitHub Actions; added `::add-mask::` in all 3 workflow job locations
  - Ran full plaintext-secret audit; all checks clean
  - Created `docs/secret-rotation.md` with complete rotation procedures for application secrets, dotenvx key rotation, Terraform state key rotation, verification steps, and rollback procedures
