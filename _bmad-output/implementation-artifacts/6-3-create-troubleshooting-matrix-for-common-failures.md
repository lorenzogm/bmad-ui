# Story 6.3: Create Troubleshooting Matrix for Common Failures

Status: ready-for-dev

## Story

As a support user,
I want a troubleshooting matrix for common setup and pipeline failures,
so that I can diagnose and resolve issues quickly.

## Acceptance Criteria

1. **Given** common failure categories, **When** documented, **Then** at minimum secrets, CI validation, deployment, and local runtime issues are covered.

2. **Given** each failure category, **When** reviewed, **Then** symptoms, likely causes, and resolution steps are listed.

3. **Given** unresolved issues, **When** users escalate, **Then** docs include what evidence to collect, including logs, command output, and workflow run links.

## Tasks / Subtasks

- [ ] Create `docs/troubleshooting.md` with the full troubleshooting matrix (AC: #1, #2, #3)
  - [ ] Section 1: Local Runtime Failures (pnpm not found, port conflict, Biome, TypeScript aliases)
  - [ ] Section 2: CI Validation Failures (lint, type check, test, build step failures)
  - [ ] Section 3: Secrets Failures (DOTENV_PRIVATE_KEY missing, .env.keys not found, decryption error)
  - [ ] Section 4: Deployment Failures (Vercel token invalid, project ID not found, Terraform state issues)
  - [ ] Section 5: Escalation Evidence Collection (what to gather before opening an issue)
- [ ] Link `docs/troubleshooting.md` from `README.md` Support section (AC: #1)
  - [ ] Add or update the support/troubleshooting link in README.md
- [ ] Verify `docs/development-guide-bmad-ui.md` Troubleshooting section links to new file for CI/deployment topics (AC: #1)
- [ ] Run `cd _bmad-custom/bmad-ui && pnpm run check` to confirm no regressions

## Dev Notes

### This Is a Documentation-Only Story

**Do NOT modify any source code** in `src/`, configs (`vite.config.ts`, `tsconfig.json`, `biome.json`), or CI workflow files. All changes are in `docs/` and `README.md`.

### Output: New File `docs/troubleshooting.md`

Create a new file at `docs/troubleshooting.md`. The existing `docs/development-guide-bmad-ui.md` already covers local dev troubleshooting (Biome, TypeScript aliases, pnpm, port conflict) — the new file should cover those briefly and add the missing CI, secrets, and deployment categories. Do not duplicate the dev guide verbatim; summarize local issues and expand the new categories.

### Failure Categories and Known Issues

**Category 1: Local Runtime**

Known issues from `docs/development-guide-bmad-ui.md`:
- `pnpm` not found → install `npm install -g pnpm` or corepack
- Port conflict → Vite auto-increments from 5173; check terminal output
- Biome not formatting → confirm `biomejs.biome` extension active in VS Code
- TypeScript aliases not resolving → set `"typescript.tsdk"` in `.vscode/settings.json`

Critical new issue (Story 6.1 context):
- `pnpm install` fails from repo root → must run `cd _bmad-custom/bmad-ui` first; `package.json` and `pnpm-lock.yaml` live there, NOT at root
- `pnpm dev` / `pnpm run check` from root → "Missing script" error; same fix: `cd _bmad-custom/bmad-ui`

**Category 2: CI Validation Failures** (from `.github/workflows/ci.yml`)

CI runs these steps in order: Lint → Type check → Tests → Build. Each can fail independently.

- **Lint step fails** (`pnpm check:lint`) → Biome found violations; see the step logs for file/line; fix locally with `pnpm check:lint --fix` in `_bmad-custom/bmad-ui`
- **Type check fails** (`pnpm check:types` = `tsc --noEmit`) → TypeScript errors; run locally; common: missing `import type`, wrong path alias, type mismatch
- **Tests fail** (`pnpm check:tests` = `vitest run --passWithNoTests`) → currently passes with no tests; fails only if a test file has broken imports or failing assertions
- **Build fails** (`pnpm build` = `tsc --noEmit && vite build`) → TypeScript must pass first; then Vite bundling; check for missing assets or circular imports
- **pnpm install --frozen-lockfile fails** → `pnpm-lock.yaml` is out of sync with `package.json`; run `pnpm install` locally to regenerate, commit the updated lockfile

To reproduce any CI failure locally:
```bash
cd _bmad-custom/bmad-ui
pnpm run check   # runs all four steps; stops on first failure
```

**Category 3: Secrets Failures** (from `docs/secrets-workflow.md` and `.github/workflows/deploy.yml`)

The deployment pipeline uses dotenvx to decrypt `.env`. Secrets required in CI are stored as GitHub repository secrets (`DOTENV_PRIVATE_KEY`, `TERRAFORM_STATE_ENCRYPT_KEY`).

- **`DOTENV_PRIVATE_KEY` not set in CI** → deploy workflow fails at "Load secrets from encrypted .env" step; symptom: `dotenvx: missing DOTENV_PRIVATE_KEY`; fix: add the secret to GitHub repo Settings → Secrets → `DOTENV_PRIVATE_KEY`
- **`.env.keys` missing locally** → local `dotenvx run --` commands fail; `.env.keys` is gitignored (never committed); maintainers must obtain it out-of-band; contributors never need it (app runs without secrets)
- **Decryption error** → wrong `DOTENV_PRIVATE_KEY` value; verify the key matches the public key in `.env` (`DOTENV_PUBLIC_KEY`)
- **`TERRAFORM_STATE_ENCRYPT_KEY` not set** → Terraform state decrypt fails; same fix: add to GitHub Secrets

Evidence to collect for secrets failures:
- GitHub Actions step logs from the "Load secrets from encrypted .env" step
- The exact error message (redacted of key values)
- Whether the `DOTENV_PRIVATE_KEY` secret shows as "set" in repo Settings → Secrets (you can see it exists without seeing the value)

**Category 4: Deployment Failures** (from `.github/workflows/deploy.yml`)

Deploy flow: check-changes → infra-deploy (Terraform) → deploy (Vercel preview) → deploy-production.

- **"Unable to resolve Vercel project ID"** → `VERCEL_TOKEN` is invalid or expired, or the project name `bmad-ui-dev`/`bmad-ui-prod` doesn't exist yet in Vercel; fix: rotate the token or run `infra-deploy` first (Terraform creates the project)
- **Terraform init/plan/apply fails** → usually a missing or mismatched `TERRAFORM_STATE_ENCRYPT_KEY`, or Vercel API quota; check the Terraform step output; state file is stored encrypted on the `terraform-state` branch
- **Terraform state decryption fails** → `TERRAFORM_STATE_ENCRYPT_KEY` changed or is wrong; the encrypted state file at `infra/vercel/src/terraform-*.tfstate.enc` on the `terraform-state` branch can't be decrypted; maintainer must re-encrypt with the correct key or start fresh with `terraform import`
- **Vercel deploy returns no URL** → `vercel deploy --prod` failed silently; check the deploy step raw logs for Vercel CLI errors
- **`infra-deploy` skipped but `deploy` fails on project ID** → infra-changed was `false` but the project doesn't exist; manually trigger `workflow_dispatch` to force both jobs to run

Evidence to collect for deployment failures:
- GitHub Actions workflow run URL (e.g., `https://github.com/lorenzogm/bmad-ui/actions/runs/<run-id>`)
- The failing job name and step name
- Full step log output (click the step to expand in GitHub UI)
- For Terraform failures: the `terraform plan` output from the previous successful run (if available)

### Files to Create/Modify

| File | Action |
|---|---|
| `docs/troubleshooting.md` | Create — new troubleshooting matrix |
| `README.md` | Edit — add/update troubleshooting link in Support section |

Do not modify `docs/development-guide-bmad-ui.md` unless a specific inaccuracy is found (it's accurate after Story 5.3). The new file complements it; link from the dev guide's Troubleshooting section to `docs/troubleshooting.md` for CI/deployment topics.

### Troubleshooting Matrix Structure

Each entry in `docs/troubleshooting.md` should follow this pattern:

```
### [Issue Title]

**Symptom:** What the user sees (error message, behavior, etc.)
**Likely cause:** Root cause explanation
**Resolution:** Step-by-step fix
**Evidence to collect (if unresolved):** Specific logs, commands, URLs to share when escalating
```

### README.md Support Section

The current README.md Support section reads:
> For questions or issues, please open an issue on GitHub or refer to the [BMAD documentation](https://github.com/lorenzogm/bmad-ui).

Add a direct link to `docs/troubleshooting.md` here and/or in the Quick Start section (Story 6.1 also links to it from Quick Start, but that story is status `ready-for-dev` — coordinate: if 6.1 is done first, the README Quick Start already has a troubleshooting link; if 6.3 is done first, the README Support section should link to the new file).

### Verification

After completing:
1. `docs/troubleshooting.md` exists and covers all 4 failure categories + escalation section
2. Each entry has symptom, cause, resolution, and evidence-to-collect fields
3. `README.md` has a link to `docs/troubleshooting.md`
4. `cd _bmad-custom/bmad-ui && pnpm run check` passes cleanly — no regressions

### Project Structure Notes

- `docs/` is at the **repository root** alongside `README.md`
- `docs/development-guide-bmad-ui.md` covers local dev (keep as-is); new `docs/troubleshooting.md` covers CI, secrets, deployment, and summaries of local issues
- App source is in `_bmad-custom/bmad-ui/src/` — do not touch
- CI workflow files are in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` — do not touch

### References

- [Source: epics.md#Story-6.3] — User story, acceptance criteria, FR35 mapping
- [Source: epics.md#Epic-6] — Epic objective: diagnose common failures from troubleshooting guide
- [Source: .github/workflows/ci.yml] — CI steps: Lint, Type check, Tests, Build, Summary
- [Source: .github/workflows/deploy.yml] — Deploy flow: check-changes, infra-deploy, deploy, deploy-production
- [Source: docs/secrets-workflow.md] — dotenvx encryption model, DOTENV_PRIVATE_KEY usage
- [Source: docs/development-guide-bmad-ui.md#Troubleshooting] — Existing local dev troubleshooting (complement, don't duplicate)
- [Source: implementation-artifacts/6-1-publish-fast-local-setup-guide.md] — Story 6.1 context: README Quick Start fix, pnpm root issue, troubleshooting link in Quick Start

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
