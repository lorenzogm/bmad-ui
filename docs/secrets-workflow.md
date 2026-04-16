# Secrets Workflow — dotenvx

This guide covers the encrypted secrets workflow for bmad-ui maintainers. It explains the encryption model, what gets committed, and how to manage secrets locally and in CI.

---

## Overview

bmad-ui uses [dotenvx](https://dotenvx.com) to store secrets encrypted at rest inside `.env`. The encrypted file is safe to commit to the repository. The private decryption key is **never committed**.

```
.env (committed — encrypted values, safe to commit)
├── DOTENV_PUBLIC_KEY="03bbdc..."   ← public key, safe to commit
└── VERCEL_TOKEN="encrypted:BIHc..."  ← encrypted with public key

.env.keys (NEVER committed — in .gitignore)
└── DOTENV_PRIVATE_KEY="d7ad2d..."   ← decrypts all keys
```

**Local usage**: dotenvx reads `.env.keys` automatically from disk.  
**CI usage**: `DOTENV_PRIVATE_KEY` env var is set from a GitHub Secret; dotenvx uses it instead of `.env.keys`.

---

## Prerequisites

Install dotenvx (one-time, system-wide):

```bash
npm install -g @dotenvx/dotenvx   # via npm
# or
brew install dotenvx              # via Homebrew
```

Verify:

```bash
dotenvx --version   # should be 1.61.0 or higher
```

---

## Local Usage

### Running commands with decrypted secrets

Prefix any command with `dotenvx run --` to inject decrypted environment variables:

```bash
dotenvx run -- pnpm dev
dotenvx run -- terraform plan
dotenvx run -- terraform apply
```

### Reading a specific value

```bash
dotenvx run -- env | grep VERCEL_TOKEN
```

### Verifying decryption works

```bash
dotenvx run -- sh -c 'test -n "$VERCEL_TOKEN" && echo "VERCEL_TOKEN is available"'
```

If decryption succeeds, the command confirms the secret is available without printing its plaintext.

---

## Secrets Inventory

Current secrets stored encrypted in `.env`:

| Key | Purpose |
|-----|---------|
| `DOTENV_PUBLIC_KEY` | dotenvx public key for this repo (auto-managed) |
| `TF_VAR_GH_PAT_TOKEN` | GitHub PAT for Terraform GitHub provider |
| `TF_VAR_GITHUB_OWNER` | GitHub org/user for Terraform |
| `TERRAFORM_STATE_ENCRYPT_KEY` | AES key for encrypting Terraform state |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_TOKEN` | Vercel API token |

Also stored as plain GitHub Secrets (not in `.env`, needed before dotenvx runs):

| Secret | Purpose |
|--------|---------|
| `DOTENV_PRIVATE_KEY` | Decrypts `.env` in CI |
| `TERRAFORM_STATE_ENCRYPT_KEY` | Needed before dotenvx runs in Terraform steps |

---

## Adding a New Secret

```bash
dotenvx set KEY "value"
```

This command:
1. Encrypts `value` using the repository public key
2. Writes the encrypted value to `.env`
3. Leaves `.env.keys` unchanged

Commit the updated `.env` file — the new secret is safe to commit because it is encrypted.

---

## Rotating a Secret

1. Update the secret locally:
   ```bash
   dotenvx set KEY "new-value"
   ```
2. Commit the updated `.env`
3. If the secret is also stored as a GitHub Secret (e.g. `VERCEL_TOKEN`), update it in:
   **Repository → Settings → Secrets and variables → Actions**

---

## CI Usage

GitHub Actions workflows decrypt secrets by passing the private key as an environment variable:

```yaml
- name: Deploy
  env:
    DOTENV_PRIVATE_KEY: ${{ secrets.DOTENV_PRIVATE_KEY }}
  run: |
    pnpm dlx @dotenvx/dotenvx run -- sh -c 'terraform apply -auto-approve'
```

dotenvx detects `DOTENV_PRIVATE_KEY` in the environment and uses it to decrypt `.env` without needing `.env.keys` on disk.

The `DOTENV_PRIVATE_KEY` GitHub Secret must match the private key originally used to encrypt the `.env` file.

---

## What Gets Committed vs. Never Committed

| File | Committed? | Why |
|------|-----------|-----|
| `.env` | ✅ Yes | Contains only encrypted values; safe to commit |
| `.env.keys` | ❌ No | Contains the private decryption key; gitignored |
| `.env.local` | ❌ No | Plaintext; gitignored |
| `.env.*.local` | ❌ No | Plaintext; gitignored |
| `.env.production` | ❌ No | Plaintext; gitignored |
| `.env.development` | ❌ No | Plaintext; gitignored |

---

## Initial Setup (New Maintainer Onboarding)

To work with secrets locally as a maintainer:

1. Install dotenvx (see [Prerequisites](#prerequisites))
2. Obtain `.env.keys` from a current maintainer (or from your password manager)
3. Place `.env.keys` at the repository root — it is gitignored and will not be committed
4. Verify setup:
   ```bash
   dotenvx run -- env | grep VERCEL_TOKEN
   ```

---

## References

- [dotenvx documentation](https://dotenvx.com/docs)
- [`.env`](../.env) — encrypted secrets file (safe to inspect)
- [`.gitignore`](../.gitignore) — exclusion rules for secret files
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — CI dotenvx pattern
- [architecture.md](../_bmad-output/planning-artifacts/architecture.md) — NFR5, NFR6 security controls
