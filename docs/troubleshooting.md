# Troubleshooting

This guide covers common setup and pipeline failures across four categories: local runtime, CI validation, secrets, and deployment.

For local development environment setup issues (Biome, TypeScript aliases, pnpm, port conflicts), see [Development Guide](development-guide-bmad-ui.md#troubleshooting). This file covers those briefly and expands on CI, secrets, and deployment failures.

---

## Section 1: Local Runtime Failures

### `pnpm` command not found

**Symptom:** `command not found: pnpm` when running `pnpm install` or `pnpm dev`
**Likely cause:** pnpm is not installed globally
**Resolution:**
```bash
npm install -g pnpm
# or
corepack enable && corepack prepare pnpm@latest --activate
```
**Evidence to collect (if unresolved):** Output of `node --version`, `npm --version`, and the full error message

---

### `pnpm install` fails from repo root

**Symptom:** `ERR_PNPM_NO_PKG_MANIFEST  No package.json (or package.yaml, or package.json5) was found in /path/to/bmad-ui`
**Likely cause:** `package.json` and `pnpm-lock.yaml` live in `_bmad-ui/`, not at the repository root
**Resolution:**
```bash
cd _bmad-ui
pnpm install
```
**Evidence to collect (if unresolved):** Full error output and your current working directory (`pwd`)

---

### `pnpm dev` or `pnpm run check` fails with "Missing script"

**Symptom:** `ERR_PNPM_NO_SCRIPT  Missing script: dev` when running from the repo root
**Likely cause:** Same root cause — pnpm scripts are defined in `_bmad-ui/package.json`
**Resolution:**
```bash
cd _bmad-ui
pnpm dev       # start dev server
pnpm run check # run full quality gate
```
**Evidence to collect (if unresolved):** Your current directory and the exact command run

---

### Dev server port conflict

**Symptom:** Dev server starts on an unexpected port (5174, 5175, etc.)
**Likely cause:** Port 5173 is already in use by another process
**Resolution:** Check the terminal output — Vite auto-increments the port and prints the actual URL. Open the URL shown in the terminal.
**Evidence to collect (if unresolved):** Output of `lsof -i :5173` and the Vite startup output

---

### Biome not formatting on save

**Symptom:** Files are not auto-formatted on save in VS Code
**Likely cause:** `biomejs.biome` extension not active, or another formatter is overriding Biome
**Resolution:**
1. Confirm `biomejs.biome` extension is installed and enabled
2. Check the status bar — it shows the active formatter for the open file
3. Run `pnpm run check:lint` to verify Biome can run from the terminal
**Evidence to collect (if unresolved):** VS Code status bar screenshot and output of `pnpm run check:lint`

---

### TypeScript path aliases not resolving in editor

**Symptom:** `@/*` imports show as unresolved in VS Code, red underlines on imports
**Likely cause:** VS Code is using a different TypeScript installation, not the project's
**Resolution:** Ensure `.vscode/settings.json` contains:
```json
{
  "typescript.tsdk": "_bmad-ui/node_modules/typescript/lib"
}
```
Then reload: **Command Palette → TypeScript: Restart TS Server**
**Evidence to collect (if unresolved):** Contents of `.vscode/settings.json` and VS Code TypeScript version shown in the status bar

---

## Section 2: CI Validation Failures

CI runs these steps in order: `pnpm install --frozen-lockfile` → Lint → Type check → Tests → Build. Each can fail independently.

### `pnpm install --frozen-lockfile` fails

**Symptom:** CI fails at the install step with `ERR_PNPM_OUTDATED_LOCKFILE` or similar
**Likely cause:** `pnpm-lock.yaml` is out of sync with `package.json` (e.g., a dependency was added without committing the updated lockfile)
**Resolution:**
```bash
cd _bmad-ui
pnpm install        # regenerates pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "chore: update pnpm lockfile"
```
**Evidence to collect (if unresolved):** The full CI log for the install step and `git diff pnpm-lock.yaml`

---

### Lint step fails (`pnpm check:lint`)

**Symptom:** CI fails at "Lint" step with Biome violations; step log shows file paths and rule names
**Likely cause:** Code committed without passing Biome checks locally
**Resolution:**
```bash
cd _bmad-ui
pnpm run check:lint --fix   # auto-fix what Biome can fix
pnpm run check:lint         # verify all clear
```
**Evidence to collect (if unresolved):** The exact rule name and file from the CI step log

---

### Type check fails (`pnpm check:types`)

**Symptom:** CI fails at "Type check" step; errors like `TS2345`, `TS2322`, `Cannot find module '@/...'`
**Likely cause:** TypeScript errors committed — missing `import type`, wrong path alias, type mismatch
**Resolution:**
```bash
cd _bmad-ui
pnpm run check:types   # run locally to see same errors
```
Fix each error reported, then re-run to confirm clean.
**Evidence to collect (if unresolved):** Full TypeScript error output from CI step log

---

### Tests fail (`pnpm check:tests`)

**Symptom:** CI fails at "Test" step; `vitest run` exits non-zero
**Likely cause:** A test file has broken imports or a failing assertion. (Note: the suite currently passes with no tests via `--passWithNoTests`; this only fails if a test file exists with errors.)
**Resolution:**
```bash
cd _bmad-ui
pnpm run check:tests   # reproduce locally
```
Fix the broken test or import, then re-run.
**Evidence to collect (if unresolved):** Full test output from CI step log

---

### Build fails (`pnpm build`)

**Symptom:** CI fails at "Build" step; Vite bundling errors or TypeScript errors during build
**Likely cause:** TypeScript errors that only surface during full compilation, missing assets, or circular imports
**Resolution:**
```bash
cd _bmad-ui
pnpm run build   # reproduce locally; TypeScript must pass before bundling
```
**Evidence to collect (if unresolved):** Full build output from CI step log, especially any `tsc` errors before the Vite output

---

### Reproducing any CI failure locally

All four steps can be reproduced with a single command:
```bash
cd _bmad-ui
pnpm run check   # runs lint → types → tests → build; stops on first failure
```

---

## Section 3: Secrets Failures

The deployment pipeline uses [dotenvx](https://dotenvx.com) to decrypt `.env`. Secrets required in CI are stored as GitHub repository secrets: `DOTENV_PRIVATE_KEY` and `TERRAFORM_STATE_ENCRYPT_KEY`.

Contributors running the app locally **do not need any secrets** — the app runs fully without them.

### `DOTENV_PRIVATE_KEY` not set in CI

**Symptom:** Deploy workflow fails at "Load secrets from encrypted .env" step with `dotenvx: missing DOTENV_PRIVATE_KEY` or similar
**Likely cause:** The `DOTENV_PRIVATE_KEY` secret has not been added to GitHub repository secrets
**Resolution:**
1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Add `DOTENV_PRIVATE_KEY` with the value from your `.env.keys` file (line starting with `DOTENV_PRIVATE_KEY=`)
**Evidence to collect (if unresolved):**
- GitHub Actions step logs from the "Load secrets from encrypted .env" step
- The exact error message (redact any key values)
- Confirm whether `DOTENV_PRIVATE_KEY` appears in Settings → Secrets (you can verify it exists without seeing the value)

---

### `.env.keys` missing locally

**Symptom:** Local `dotenvx run -- <command>` fails; error about missing key file
**Likely cause:** `.env.keys` is gitignored and never committed — it must be obtained out-of-band from a maintainer
**Resolution:** Contributors do not need `.env.keys` to run the app. If you are a maintainer, obtain the file from the project owner.
**Evidence to collect (if unresolved):** The exact error message from `dotenvx`

---

### Decryption error

**Symptom:** `dotenvx` runs but decryption fails; error like "could not decrypt" or "invalid key"
**Likely cause:** The `DOTENV_PRIVATE_KEY` value is wrong — it doesn't match the public key in `.env`
**Resolution:**
1. Check `.env` for `DOTENV_PUBLIC_KEY=<value>`
2. Verify the private key in `.env.keys` corresponds to that public key
3. If the GitHub secret is wrong, rotate it: update `DOTENV_PRIVATE_KEY` in GitHub Secrets with the correct value
**Evidence to collect (if unresolved):**
- The `DOTENV_PUBLIC_KEY` value from `.env` (safe to share — it's public)
- The exact decryption error message
- See [docs/secrets-workflow.md](secrets-workflow.md) for the full encryption model

---

### `TERRAFORM_STATE_ENCRYPT_KEY` not set

**Symptom:** Terraform step fails to decrypt state; error about missing encryption key
**Likely cause:** `TERRAFORM_STATE_ENCRYPT_KEY` secret not added to GitHub Actions
**Resolution:** Add `TERRAFORM_STATE_ENCRYPT_KEY` to GitHub → Repository → Settings → Secrets and variables → Actions
**Evidence to collect (if unresolved):** Full Terraform step logs from the failing CI run

---

## Section 4: Deployment Failures

Deploy workflow flow: `check-changes` → `infra-deploy` (Terraform) → `deploy` (Vercel preview) → `deploy-production`

### "Unable to resolve Vercel project ID"

**Symptom:** Deploy step fails with "project not found" or similar Vercel CLI error
**Likely cause:** `VERCEL_TOKEN` is invalid/expired, or the Vercel project (`bmad-ui-dev` / `bmad-ui-prod`) doesn't exist yet
**Resolution:**
1. Verify `VERCEL_TOKEN` in GitHub Secrets is current (rotate if expired: Vercel Dashboard → Account → Tokens)
2. If the project doesn't exist yet, run the `infra-deploy` job first (Terraform creates the Vercel project)
3. To force both jobs to run: GitHub Actions → `deploy.yml` → Run workflow (workflow_dispatch)
**Evidence to collect (if unresolved):**
- GitHub Actions workflow run URL (`https://github.com/lorenzogm/bmad-ui/actions/runs/<run-id>`)
- The failing job name and step name
- Full step log output (click the step to expand in GitHub UI)

---

### Terraform init/plan/apply fails

**Symptom:** `infra-deploy` job fails at a Terraform step
**Likely cause:** Missing or mismatched `TERRAFORM_STATE_ENCRYPT_KEY`, Vercel API quota exceeded, or state file corruption
**Resolution:**
1. Check that `TERRAFORM_STATE_ENCRYPT_KEY` is set in GitHub Secrets
2. Review the `terraform plan` output in the step log for the specific error
3. For Vercel API errors: check Vercel dashboard for quota or billing issues
**Evidence to collect (if unresolved):**
- Full `terraform init` / `terraform plan` output from the CI step log
- The `terraform plan` output from the previous successful run (if available)

---

### Terraform state decryption fails

**Symptom:** Terraform step errors with "failed to decrypt state" or similar
**Likely cause:** `TERRAFORM_STATE_ENCRYPT_KEY` was changed or is wrong; the encrypted state file on the `terraform-state` branch can't be decrypted
**Resolution:**
1. Verify `TERRAFORM_STATE_ENCRYPT_KEY` in GitHub Secrets matches the key used to originally encrypt the state
2. If the key was rotated: re-encrypt the state with the new key, or start fresh with `terraform import` to reconstruct state
3. See [docs/deployment-guide.md](deployment-guide.md) for the Terraform state management details
**Evidence to collect (if unresolved):**
- Full Terraform error from CI step log
- Whether the `terraform-state` branch exists and has a `.tfstate.enc` file: `git ls-remote origin terraform-state`

---

### Vercel deploy returns no URL

**Symptom:** `deploy` job completes but no preview URL is produced; no visible error in CI summary
**Likely cause:** `vercel deploy --prod` failed silently or the Vercel CLI output wasn't captured
**Resolution:** Check the raw deploy step logs (expand the step in GitHub UI) for Vercel CLI error messages
**Evidence to collect (if unresolved):**
- The full raw deploy step log (not just the CI summary)
- GitHub Actions workflow run URL

---

### `infra-deploy` skipped but `deploy` fails on project ID

**Symptom:** CI run skips `infra-deploy` (infrastructure not changed) but `deploy` fails because the Vercel project doesn't exist
**Likely cause:** `check-changes` reported `infra-changed: false`, but the project was never created (e.g., first-time setup)
**Resolution:** Manually trigger the full workflow via GitHub Actions → `deploy.yml` → Run workflow (workflow_dispatch) to force both `infra-deploy` and `deploy` to execute
**Evidence to collect (if unresolved):**
- The `check-changes` job output showing what was detected as changed
- The `deploy` job error about the missing project ID

---

## Section 5: Escalation Evidence Collection

Before opening a GitHub issue, collect this evidence to help maintainers diagnose quickly:

### For all failures

- [ ] **Exact error message** — copy the full error text (redact secrets/tokens)
- [ ] **Reproduction steps** — the exact commands run and the order
- [ ] **Environment** — OS, Node.js version (`node --version`), pnpm version (`pnpm --version`)

### For CI/deployment failures

- [ ] **GitHub Actions workflow run URL** — `https://github.com/lorenzogm/bmad-ui/actions/runs/<run-id>`
- [ ] **Failing job and step name** — e.g., "CI / Build" or "deploy / infra-deploy / Terraform apply"
- [ ] **Full step log** — expand the failing step in GitHub UI and copy the complete output
- [ ] **Branch and commit SHA** — `git log --oneline -1`

### For secrets failures

- [ ] **Whether the secret exists** in GitHub Settings → Secrets and variables → Actions (confirm name, not value)
- [ ] **The exact dotenvx or Terraform error** (redact any key values)
- [ ] **`DOTENV_PUBLIC_KEY` value** from `.env` (safe to share — it's the public key)

### For local runtime failures

- [ ] **Output of `node --version` and `pnpm --version`**
- [ ] **Current working directory** (`pwd`) when the command was run
- [ ] **Full terminal output** including the command and all output lines

### Opening the issue

1. Check [existing issues](https://github.com/lorenzogm/bmad-ui/issues) first
2. Use the **bug report** issue template
3. Include all evidence collected above
4. Label the issue appropriately (`bug`, `ci`, `deployment`, `docs`, etc.)
