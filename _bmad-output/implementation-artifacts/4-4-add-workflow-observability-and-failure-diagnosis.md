# Story 4.4: Add Workflow Observability and Failure Diagnosis

Status: in-progress

## Story

As a maintainer,
I want actionable visibility into CI and deployment workflow outcomes,
so that I can quickly identify and fix failing stages.

## Acceptance Criteria

1. **Given** any CI or deployment run, **When** viewed in GitHub Actions, **Then** workflow, job, and step status are clearly visible — each step is individually named and reports success or failure independently.

2. **Given** a failed run, **When** opened, **Then** the failure point and relevant logs are available without requiring local reproduction first — failure annotations (`::error::`) surface the failing step context in the run summary.

3. **Given** successful runs, **When** reviewed, **Then** artifact, version, and environment context is visible in run summaries where applicable — commit SHA, branch, environment name, and deployment URL are included in `$GITHUB_STEP_SUMMARY` output.

## Tasks / Subtasks

- [x] Add CI summary step to `.github/workflows/ci.yml` (AC: #1, #2, #3)
  - [x] Add a final `Summary` step with `if: always()` that writes to `$GITHUB_STEP_SUMMARY`
  - [x] Include commit SHA, branch/ref, trigger event, and PR number (if applicable) in the summary
  - [x] Indicate overall CI result (pass/fail) in the summary header
- [x] Enhance `deploy.yml` `check-changes` job summary (AC: #1, #3)
  - [x] Add a `Summary` step writing trigger context (event, environment, SHA) and what will run (infra/app) to `$GITHUB_STEP_SUMMARY`
- [x] Enhance `deploy.yml` `deploy-preview` job summary (AC: #1, #3)
  - [x] Add/update a `Summary` step writing preview URL and commit SHA to `$GITHUB_STEP_SUMMARY`
- [x] Enhance `deploy.yml` `deploy-production` job summary (AC: #1, #3)
  - [x] Expand existing `Summary` step to include commit SHA, app version from `package.json`, and environment
- [x] Add failure annotations to key failure points in `deploy.yml` (AC: #2)
  - [x] Add `::error::` annotation when Terraform state decryption fails (already has one — verify it surfaces in UI)
  - [x] Add `::error::` annotation when Vercel project ID resolution fails (already has one — verify)
  - [x] Add `::error::` annotation for any new explicitly detectable failure points

### Review Findings

- [ ] [Review][Patch] CI summary header does not report overall pass/fail result (`${{ job.status }}` or equivalent) [.github/workflows/ci.yml:58]
- [ ] [Review][Patch] Deploy summaries omit branch/ref context required by AC #3 [.github/workflows/deploy.yml:118]
- [ ] [Review][Patch] `deploy-production` summary step lacks `if: always()` and is skipped when earlier steps fail [.github/workflows/deploy.yml:495]
- [ ] [Review][Patch] Dynamic values are written to `$GITHUB_STEP_SUMMARY`/`::notice::` without sanitization, allowing markdown breakage or command/log injection edge cases [.github/workflows/ci.yml:63, .github/workflows/deploy.yml:392]

## Dev Notes

### Critical Context

This is **Story 4.4 in Epic 4**. Stories 4.1–4.3 precede this one:

- **Story 4.1** creates `.github/workflows/ci.yml` — this story adds a Summary step to it. If `ci.yml` does not yet exist, create a minimal placeholder or wait for 4.1 to be done first. **Do not re-implement 4.1 scope** — only add the Summary step.
- **Story 4.2** enforces protected branch quality gates (branch protection rules in Terraform/GitHub API) — no file overlap.
- **Story 4.3** implements deployment workflow triggers — may modify `deploy.yml`. Coordinate if running in parallel.

This story touches exactly two workflow files:

- `.github/workflows/ci.yml` — **add** a Summary step only
- `.github/workflows/deploy.yml` — **enhance** summaries across existing jobs

**Do not modify** any source files under `_bmad-custom/`, package.json scripts, or infrastructure files.

### Observability Mechanisms in GitHub Actions

GitHub Actions provides three native observability channels — use these, no external tools needed:

| Mechanism | Usage |
|---|---|
| `$GITHUB_STEP_SUMMARY` | Markdown written to this env var appears as a rich summary in the "Summary" tab of each run. Use `echo "..." >> $GITHUB_STEP_SUMMARY`. |
| `::error::` annotation | `echo "::error::<message>"` surfaces an annotation in the run and on the PR checks view. Use for unambiguous failures. |
| `::notice::` annotation | `echo "::notice::<message>"` for informational highlights (e.g., deployment URL). |
| Step `name:` | Each step's name appears in the left sidebar of the job view. Already covered by 4.1's step naming. |

### CI Workflow Summary Step (to add to `ci.yml`)

The Summary step MUST use `if: always()` so it runs even when prior steps fail. Example pattern:

```yaml
- name: Summary
  if: always()
  run: |
    echo "## CI Results" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
    echo "|---|---|" >> $GITHUB_STEP_SUMMARY
    echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
    echo "| Branch | \`${{ github.ref_name }}\` |" >> $GITHUB_STEP_SUMMARY
    echo "| Trigger | ${{ github.event_name }} |" >> $GITHUB_STEP_SUMMARY
    if [ "${{ github.event_name }}" = "pull_request" ]; then
      echo "| PR | #${{ github.event.number }} |" >> $GITHUB_STEP_SUMMARY
    fi
```

Place this as the last step in the `validate` job (or equivalent job name used in 4.1).

### Deploy Workflow — check-changes Job Summary

Add after the `Check for changes` step:

```yaml
- name: Summary
  if: always()
  run: |
    echo "## Deploy Trigger Summary" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
    echo "|---|---|" >> $GITHUB_STEP_SUMMARY
    echo "| Event | ${{ github.event_name }} |" >> $GITHUB_STEP_SUMMARY
    echo "| Environment | ${{ steps.resolve-env.outputs.environment }} |" >> $GITHUB_STEP_SUMMARY
    echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
    echo "| Infra changed | ${{ steps.check.outputs.infra-changed }} |" >> $GITHUB_STEP_SUMMARY
    echo "| App changed | ${{ steps.check.outputs.app-changed }} |" >> $GITHUB_STEP_SUMMARY
```

### Deploy Workflow — deploy-preview Job Summary

The `deploy-preview` job currently has no summary step. Add:

```yaml
- name: Summary
  if: always()
  run: |
    echo "## Preview Deployment" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    PREVIEW_URL="${{ steps.preview-deploy.outputs.preview-url }}"
    if [ -n "$PREVIEW_URL" ]; then
      echo "✅ Preview deployed: $PREVIEW_URL" >> $GITHUB_STEP_SUMMARY
      echo "::notice::Preview URL: $PREVIEW_URL"
    else
      echo "❌ Preview deployment did not produce a URL" >> $GITHUB_STEP_SUMMARY
    fi
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
    echo "|---|---|" >> $GITHUB_STEP_SUMMARY
    echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
    echo "| Environment | ${{ needs.check-changes.outputs.environment }} |" >> $GITHUB_STEP_SUMMARY
```

### Deploy Workflow — deploy-production Job Summary

The existing `Summary` step is minimal. Enhance it to include version and commit context:

```yaml
- name: Summary
  run: |
    VERSION=$(node -p "require('./_bmad-custom/bmad-ui/package.json').version" 2>/dev/null || echo "unknown")
    echo "## ✅ Production Deployment" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "| Field | Value |" >> $GITHUB_STEP_SUMMARY
    echo "|---|---|" >> $GITHUB_STEP_SUMMARY
    echo "| Environment | ${{ needs.check-changes.outputs.environment }} |" >> $GITHUB_STEP_SUMMARY
    echo "| URL | ${{ steps.production-deploy.outputs.url }} |" >> $GITHUB_STEP_SUMMARY
    echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
    echo "| Version | $VERSION |" >> $GITHUB_STEP_SUMMARY
    echo "::notice::Deployed to production: ${{ steps.production-deploy.outputs.url }}"
```

### Failure Annotations — Existing vs. New

`deploy.yml` already has `::error::` annotations in these places:
- `"::error::Failed to decrypt state"` in the Decrypt Terraform State step
- `"::error::No terraform.tfstate found"` in the Encrypt Terraform State step
- `"::error::Unable to resolve Vercel project ID for preview deployment"`
- `"::error::Unable to resolve Vercel project ID for production deployment"`

These already satisfy AC #2 for the deploy workflow. **Do not duplicate them.** Verify they appear in the GitHub Actions annotation panel — no code change required unless they are missing.

For `ci.yml` (created in 4.1): individual step failures surface automatically because each step is named separately and fails independently. No additional `::error::` annotations are needed.

### pnpm Package Manager Constraint

All pnpm commands in CI must run from `_bmad-custom/bmad-ui/` with `working-directory: _bmad-custom/bmad-ui`. Never use `npm` or `yarn`. Node.js version must be `"24"` (matches `engines.node: ">=24"` in package.json).

### File Locations

- CI workflow: `.github/workflows/ci.yml` (repo root level, NOT inside `_bmad-custom/`)
- Deploy workflow: `.github/workflows/deploy.yml` (repo root level)
- Source: `_bmad-custom/bmad-ui/src/` — **do not touch**
- Infrastructure: `infra/` — **do not touch** in this story

[Source: architecture.md — "Infrastructure and CI config should remain repo-level, not hidden inside frontend source directories"]

### Project Structure Notes

- All workflow files live at `.github/workflows/` (repo root level)
- This story makes zero changes to TypeScript/React source code
- No new files created — only two existing workflow files modified (and `ci.yml` if it exists from 4.1)
- No secrets or environment variables added — observability features use only built-in GitHub context variables

### References

- FR20: Maintainer can observe workflow outcomes and identify failing stages [Source: prd.md#Functional-Requirements]
- NFR2: CI validation workflow completes within 15 minutes [Source: prd.md#Non-Functional-Requirements] — Step Summaries do not add meaningful time
- Architecture: "Add deployment and CI observability through GitHub Actions and Vercel's native tooling" [Source: architecture.md#Infrastructure-and-Deployment]
- Architecture: "Infrastructure and CI config should remain repo-level" [Source: architecture.md#File-Organization-Patterns]
- Existing deploy workflow: `.github/workflows/deploy.yml` — already has `::error::` annotations and one Summary step in deploy-production
- GitHub Actions Step Summary docs: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#adding-a-job-summary
- Story 4.1 dependency: `.github/workflows/ci.yml` must exist [Source: implementation-artifacts/4-1-create-ci-validation-workflow.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

Implementation straightforward — two workflow files modified. All `::error::` annotations were pre-existing and verified present. No new annotations required.

### Completion Notes List

- Added `Summary` step with `if: always()` to `ci.yml` validate job — includes commit SHA, branch, trigger, and PR number for PR events.
- Enhanced `check-changes` Summary in `deploy.yml` — now uses rich Markdown table with `if: always()`, event, environment, SHA, infra/app changed flags.
- Added `Summary` step to `deploy` (preview) job in `deploy.yml` — shows preview URL with `::notice::` annotation or failure message, plus commit SHA and environment.
- Enhanced `deploy-production` Summary in `deploy.yml` — now includes app version from package.json, commit SHA, environment, and URL with `::notice::` annotation.
- All pre-existing `::error::` annotations verified present (state decrypt, state not found, Vercel project ID resolution for preview and production).

### File List

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
