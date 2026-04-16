# Secret Rotation Runbook

This document describes how to rotate secrets for bmad-ui and provides rollback procedures for recovery scenarios.

---

## Overview — Two-Layer Secret Model

bmad-ui uses a two-layer model to keep credentials encrypted at rest and auditable through repository history:

**Layer 1 — dotenvx encrypted `.env` (committed to `main`)**

The `.env` file contains encrypted ciphertext values. Only the public key is committed. The private decryption key is never committed.

| Key | Stored in |
|-----|-----------|
| `TF_VAR_GH_PAT_TOKEN` | `.env` (encrypted) |
| `TF_VAR_GITHUB_OWNER` | `.env` (encrypted) |
| `TERRAFORM_STATE_ENCRYPT_KEY` | `.env` (encrypted) |
| `VERCEL_ORG_ID` | `.env` (encrypted) |
| `VERCEL_TOKEN` | `.env` (encrypted) |
| `DOTENV_PUBLIC_KEY` | `.env` (plaintext — safe to commit) |

**Layer 2 — GitHub Secrets (bootstrap secrets, not stored in `.env`)**

| Secret | Purpose |
|--------|---------|
| `DOTENV_PRIVATE_KEY` | Decrypts `.env` at CI runtime |
| `TERRAFORM_STATE_ENCRYPT_KEY` | Decrypts Terraform state before dotenvx runs |

---

## Rotating Application Secrets

Use this procedure to rotate any secret stored in `.env` (e.g., `VERCEL_TOKEN`, `TF_VAR_GH_PAT_TOKEN`).

**When to use:** Token expired, credential compromised, periodic rotation.

### Steps

1. Obtain the new secret value from the relevant service (Vercel dashboard, GitHub PAT settings, etc.).

2. Encrypt the new value and update `.env`:

   ```bash
   dotenvx set VERCEL_TOKEN "new-token-value"
   ```

   This re-encrypts the new value using the existing public key and writes it to `.env`. No other files change.

3. Commit and push:

   ```bash
   git add .env
   git commit -m "chore(secrets): rotate VERCEL_TOKEN"
   git push origin main
   ```

4. No GitHub Secret changes are needed — only the `.env` content changes.

5. Verify by triggering a workflow run (see [Verification](#verification-steps)).

---

## Rotating the dotenvx Encryption Key

Use this procedure when the private key itself is compromised or when performing a full key rotation.

**When to use:** `DOTENV_PRIVATE_KEY` compromised, security audit requirement, transferring repo ownership.

### Steps

1. Generate a new key pair (overwrites `.env.keys` and re-encrypts `.env`):

   ```bash
   dotenvx genkeys
   ```

   This command:
   - Creates a new key pair
   - Re-encrypts all values in `.env` with the new public key
   - Writes the new private key to `.env.keys`

2. Update the `DOTENV_PRIVATE_KEY` GitHub Secret with the new private key value:

   ```bash
   # Print the new private key (do not commit this output)
   cat .env.keys
   ```

   Navigate to **Repository → Settings → Secrets and variables → Actions** and update `DOTENV_PRIVATE_KEY`.

3. Commit and push the updated `.env`:

   ```bash
   git add .env
   git commit -m "chore(secrets): rotate dotenvx encryption key"
   git push origin main
   ```

   The `.env.keys` file is gitignored and must NOT be committed.

4. Securely distribute the new `.env.keys` to all authorized maintainers (e.g., via your team's password manager).

5. Verify by triggering a workflow run (see [Verification](#verification-steps)).

---

## Rotating `TERRAFORM_STATE_ENCRYPT_KEY`

Use this procedure to rotate the AES-256 key used to encrypt the Terraform state file.

**When to use:** Key compromised, security audit requirement.

### Prerequisites

- Access to both the old and new key values
- `openssl` installed locally
- Write access to the `terraform-state` branch

### Steps

1. Generate a new AES-256 key:

   ```bash
   openssl rand -hex 32
   # Save the output — this is your new TERRAFORM_STATE_ENCRYPT_KEY
   ```

2. Fetch the current encrypted state:

   ```bash
   git fetch origin terraform-state
   git show origin/terraform-state:infra/vercel/src/terraform-development.tfstate.enc > /tmp/terraform-development.tfstate.enc
   # Repeat for production if applicable:
   git show origin/terraform-state:infra/vercel/src/terraform-production.tfstate.enc > /tmp/terraform-production.tfstate.enc
   ```

3. Decrypt with the old key:

   ```bash
   OLD_KEY="<old-key-value>"
   echo "$OLD_KEY" | openssl enc -aes-256-cbc -d -in /tmp/terraform-development.tfstate.enc -out /tmp/terraform.tfstate -pass stdin
   ```

4. Re-encrypt with the new key:

   ```bash
   NEW_KEY="<new-key-value>"
   echo "$NEW_KEY" | openssl enc -aes-256-cbc -in /tmp/terraform.tfstate -out /tmp/terraform-development.tfstate.enc -pass stdin
   ```

5. Push the re-encrypted state to the `terraform-state` branch:

   ```bash
   git checkout terraform-state
   cp /tmp/terraform-development.tfstate.enc infra/vercel/src/terraform-development.tfstate.enc
   git add infra/vercel/src/terraform-development.tfstate.enc
   git commit -m "chore: re-encrypt terraform state with new key"
   git push origin terraform-state
   git checkout main
   ```

6. Update the `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret with the new value:

   Navigate to **Repository → Settings → Secrets and variables → Actions** and update `TERRAFORM_STATE_ENCRYPT_KEY`.

   Also update the encrypted value in `.env` (it is also stored there for Terraform steps):

   ```bash
   dotenvx set TERRAFORM_STATE_ENCRYPT_KEY "$NEW_KEY"
   git add .env
   git commit -m "chore(secrets): rotate TERRAFORM_STATE_ENCRYPT_KEY in .env"
   git push origin main
   ```

7. Securely delete local plaintext state files:

   ```bash
   rm -f /tmp/terraform.tfstate /tmp/terraform-development.tfstate.enc /tmp/terraform-production.tfstate.enc
   ```

8. Verify by triggering a workflow run (see [Verification](#verification-steps)).

---

## Verification Steps

After any rotation, confirm the pipeline continues to operate:

1. Trigger a `workflow_dispatch` run on `deploy.yml`:

   ```bash
   gh workflow run deploy.yml --field environment=development
   ```

   Or navigate to **Actions → bmad-ui-deploy → Run workflow**.

2. Watch the run and confirm all jobs succeed: `check-changes`, `infra-deploy` (if infra changed), `deploy-preview`, `deploy-production` (if production).

3. Confirm the deployed preview URL loads the application correctly.

4. Check workflow logs — secret values must appear as `***` (masked), not plaintext.

---

## Rollback Procedure

### Rollback a rotated `.env` value

If a newly rotated application secret (e.g., `VERCEL_TOKEN`) breaks the pipeline:

1. Revert the `.env` commit:

   ```bash
   git revert <commit-sha>   # creates a new commit undoing the change
   # or restore a specific version:
   git checkout <previous-sha> -- .env
   git commit -m "revert(secrets): restore previous VERCEL_TOKEN"
   git push origin main
   ```

2. Restore the old secret value in the external service (e.g., re-activate the old Vercel token if not yet expired).

3. Trigger a workflow run to confirm recovery.

### Rollback a rotated `DOTENV_PRIVATE_KEY`

If the new key breaks decryption:

1. Restore the previous `DOTENV_PRIVATE_KEY` GitHub Secret value (retrieve from your password manager).
2. Revert the `.env` commit that updated the public key:

   ```bash
   git revert <commit-sha-of-dotenvx-genkeys>
   git push origin main
   ```

3. Restore the old `.env.keys` locally from your password manager.
4. Trigger a workflow run to confirm recovery.

### Rollback a rotated `TERRAFORM_STATE_ENCRYPT_KEY`

If the new Terraform state encryption key breaks deployment:

1. Restore the previous `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret value.
2. Restore the old encrypted state file on the `terraform-state` branch:

   ```bash
   git checkout terraform-state
   git revert HEAD
   git push origin terraform-state
   git checkout main
   ```

3. Revert the `.env` commit that updated `TERRAFORM_STATE_ENCRYPT_KEY`.
4. Trigger a workflow run to confirm recovery.

---

## Audit Results

Recorded after completing story 3.3 (2026-04-16):

| Check | Result |
|-------|--------|
| `.env.keys` in `.gitignore` | ✅ Confirmed |
| `.env.keys` never committed (`git ls-files --cached .env.keys`) | ✅ Empty — never tracked |
| `.env` has no plaintext values (only `encrypted:` or `DOTENV_PUBLIC_KEY`) | ✅ Confirmed |
| `git log --all --full-history -- '.env.keys'` | ✅ Empty — no history |
| No `set -x` or `run: env` debug commands in `deploy.yml` | ✅ Confirmed |
| `::add-mask::` added for all dotenvx-decrypted secrets in `deploy.yml` | ✅ Added to all 3 job locations |

---

## References

- [`docs/secrets-workflow.md`](./secrets-workflow.md) — daily secrets usage guide
- [`.env`](../.env) — encrypted secrets file
- [`.gitignore`](../.gitignore) — exclusion rules for secret files
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — CI workflow with masking
- [dotenvx documentation](https://dotenvx.com/docs)
- [architecture.md — Authentication & Security](../_bmad-output/planning-artifacts/architecture.md)
