# Story 3.3: Secret Rotation and Audit-Safe Handling

Status: ready-for-dev

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

- [ ] Task 1: Fix CI log masking for dotenvx-decrypted secrets (AC: #2)
  - [ ] Audit `deploy.yml` for every step that writes a decrypted secret to `$GITHUB_ENV` or uses it in a shell expression
  - [ ] Add `echo "::add-mask::$VALUE"` before each `echo "KEY=$VALUE" >> "$GITHUB_ENV"` write for `VERCEL_TOKEN` and `VERCEL_ORG_ID` (these are decrypted by dotenvx and are not auto-masked by GitHub Actions)
  - [ ] Verify `TERRAFORM_STATE_ENCRYPT_KEY` (a direct GitHub Secret) is already auto-masked since it comes from `${{ secrets.TERRAFORM_STATE_ENCRYPT_KEY }}`
  - [ ] Verify `DOTENV_PRIVATE_KEY` (a direct GitHub Secret) is auto-masked
  - [ ] Confirm no `set -x` or `run: env` debug commands are present in the workflow

- [ ] Task 2: Run plaintext-secret audit scan (AC: #3)
  - [ ] Confirm `.env.keys` is in `.gitignore` and has never been tracked: `git ls-files --cached .env.keys` (must return empty)
  - [ ] Scan all tracked files for patterns matching `DOTENV_PRIVATE_KEY_*=`, `TF_VAR_GH_PAT_TOKEN=`, raw token-like strings using `git grep -i "private_key\s*=\s*[^e]"` — any hit that is NOT prefixed `encrypted:` is a plaintext leak
  - [ ] Confirm the committed `.env` file contains only `encrypted:...` values (no plaintext), verifiable with `grep -v "encrypted:" .env | grep "="` returning only `DOTENV_PUBLIC_KEY=`
  - [ ] Run `git log --all --full-history -- '.env.keys'` to verify the file has never been committed
  - [ ] Document audit results in the runbook

- [ ] Task 3: Create secret rotation runbook (AC: #1, #4)
  - [ ] Create `docs/secret-rotation.md` with the full rotation procedure (see Dev Notes for required sections)
  - [ ] Document dotenvx re-encryption steps for updating a secret value
  - [ ] Document how to update the `DOTENV_PRIVATE_KEY` GitHub Secret when the encryption key changes
  - [ ] Document how to update `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret
  - [ ] Verify pipeline continues working after rotation by documenting test steps

- [ ] Task 4: Document rollback procedure (AC: #4)
  - [ ] Add rollback section to `docs/secret-rotation.md`
  - [ ] Describe reverting encrypted `.env` via `git revert` or `git checkout <sha> -- .env`
  - [ ] Describe restoring previous GitHub Secret values
  - [ ] Describe re-running deploy workflow to confirm system recovery

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

### Completion Notes List

### File List
