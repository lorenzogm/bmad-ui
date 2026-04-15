---
storyId: '1-2'
storyTitle: 'Configure Branch Protection Rules'
epicId: '1'
epicTitle: 'Open-Source Repository Governance & Publication'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 1.2: Configure Branch Protection Rules

## Story Statement

**As a** maintainer,  
**I want** branch protection rules configured on `main` that enforce CI checks on PRs while allowing maintainer direct pushes,  
**So that** the branch stays protected for contributors without blocking my own workflow.

---

## Acceptance Criteria

### Branch Protection Configuration

- ✅ Branch protection rule is **enabled** on `main` branch
- ✅ At least **1 required status check** is configured (CI workflow job from Epic 1 Story 1)
- ✅ **Dismissal of stale pull request approvals** is enabled when new commits are pushed
- ✅ **Require status checks to pass before merging** is enabled
- ✅ **Require branches to be up to date before merging** is disabled (to avoid unnecessary CI re-runs on outdated branches during merge window)

### Admin Bypass & Contributor Controls

- ✅ **Force pushes from non-admins are disabled** (prevent accidental history rewrites)
- ✅ **Admin bypass is enabled** (maintainer can push directly to `main` without PR)
- ✅ **Dismissal of pull request reviews** on push is enabled (require new review after new commits)

### PR & Merge Controls

- ✅ **Require at least 1 pull request review before merging** is NOT configured for Phase 1 (MVP scope is CI gates only; manual review governance is deferred)
- ✅ **Require conversation resolution before merging** is disabled for Phase 1 (deferred to Phase 2)
- ✅ **Merge method**: Squash merge is allowed (simplifies history in Phase 1)
- ✅ **Automatically delete head branches after merge** is enabled (cleanup)

### Verification

- ✅ A test PR that **fails CI checks** verifies the merge button is **blocked**
- ✅ Direct push from maintainer (admin) to `main` **succeeds** without PR requirement
- ✅ Branch protection is **visible and correct** in GitHub repository settings

---

## Developer Context

### Why This Story Matters

Branch protection is a **quality gate**: it ensures that all code reaching `main` has passed automated validation (CI checks). Without it, broken code could merge and block development. For Phase 1, the gate is **CI checks only** — no manual approval gates yet.

The maintainer bypass is essential: as the sole maintainer during Phase 1, you need to be able to push directly to `main` for quick fixes or emergency corrections without jumping through a PR loop. Contributors, however, must go through the PR + CI gate.

### Current State

From **Story 1.1**, the frontend package has been reconciled:
- Biome linter is installed and configured
- TypeScript check is working
- Build process is functional
- CI workflow is expected to be running (defined in Epic 4 Story 1, but referenced by Story 1.2's acceptance criteria)

**Important:** Story 1.2 assumes that a CI workflow exists (typically `ci.yaml` or `lint-and-build.yaml` in `.github/workflows/`). If the CI workflow has not yet been created, this story will configure the *rule* but the required status check will not be selectable until the workflow runs at least once. See [CI Workflow Timing](#ci-workflow-timing) below.

### Branch Protection in GitHub

**Branch Protection Rule Definition:**

In GitHub repository settings, a branch protection rule is a set of constraints applied to a branch (usually `main`). When a rule is active, it:
- Prevents merge PRs if required checks fail
- Can prevent force-pushes and direct pushes (unless admin)
- Can enforce review requirements and conversation resolution
- Can automatically delete head branches after merge

GitHub applies rules per branch name or branch pattern (e.g., `main`, `release/*`).

**API vs. UI:**

Branch protection can be configured:
1. **GitHub UI**: Settings → Branches → Add rule
2. **GitHub REST API**: `PUT /repos/{owner}/{repo}/branches/{branch}/protection`
3. **Terraform**: `github_branch_protection` resource (used in Epic 2 Story 1 for Infrastructure as Code)

For **Phase 1 Story 1.2**, you'll configure this **manually via the GitHub UI** (or via API if scripting). Story 2.1 (Terraform GitHub Infrastructure) will move this to declarative IaC.

### Phase 1 Scope: CI Gates Only

**What IS in scope for Story 1.2:**
- Require at least 1 status check (CI workflow)
- Prevent non-admin force-pushes
- Allow admin (maintainer) direct pushes and force-pushes
- Auto-delete merged branches

**What is NOT in scope (deferred to Phase 2+):**
- Require pull request reviews (manual approval gates)
- Require up-to-date branches before merge (causes extra CI runs during merge bottlenecks; not needed in Phase 1)
- Conversation resolution enforcement
- Code owner approval requirements

This scope keeps Phase 1 lean: **automation-first, human-review-second**.

### CI Workflow Timing

**Critical Detail:** The required status check dropdown in GitHub Settings will only show workflows that have **already run at least once** on the `main` branch. If you're configuring branch protection before any CI run, you may need to:

1. Ensure Story 1.1 CI checks pass locally and in any pre-merge run
2. Do the first merge to `main` (or have a CI run on `main`)
3. Return to branch protection settings and select the status check

Alternatively, if using the REST API or Terraform, you can reference the status check by job name (e.g., `"lint"`, `"typecheck"`, `"build"`) before the run exists; GitHub will validate the rule once the workflow fires.

### Implementation Approach: GitHub UI (Phase 1)

For Phase 1 (this story), you'll use the **GitHub UI**:

1. Open repository settings → **Branches**
2. Click **Add rule** (or edit existing if `main` already has one)
3. Fill in branch name pattern: `main`
4. Configure:
   - ✅ **Require a pull request before merging** → unchecked (not in Phase 1 scope)
   - ✅ **Require status checks to pass before merging** → checked
   - ✅ **Require branches to be up to date before merging** → unchecked (Phase 1 optimization)
   - ✅ **Require conversation resolution** → unchecked (Phase 1 scope)
   - ✅ **Require code reviews before merging** → unchecked (Phase 1 scope)
   - ✅ **Dismiss stale pull request approvals when new commits are pushed** → checked (good practice)
   - ✅ **Require dismissal of pull requests when code owners review** → unchecked (no code owners defined in Phase 1)
   - ✅ **Allow force pushes** → select "Dismiss pull request approvals" or "Allow all" depending on your preference
     - Phase 1 preference: **"Allow all"** (allow maintainer force-pushes during development)
   - ✅ **Allow deletions** → unchecked (prevent accidental deletions)
   - ✅ **Bypass branch protections** → checked (allows admins to merge without CI if emergency needed, but CI will still block non-admins)
   - ✅ **Require status checks to pass before merging** → select the CI job(s)
     - Example: `CI / lint`, `CI / typecheck`, `CI / build` (exact names depend on workflow definition from Story 1.1)

5. Click **Create** or **Save**

### Testing the Rule

Once branch protection is configured:

**Test 1: Failed CI Blocks Merge**
1. Create a PR that fails linting (e.g., add a syntax error or format violation)
2. Push to the PR branch
3. CI runs and fails
4. Verify merge button is **disabled** with message "Required status checks did not complete"

**Test 2: Admin Can Push Directly**
1. Make a small commit locally (e.g., update a comment)
2. `git push origin main` (directly, as admin/maintainer)
3. Verify push succeeds (does not require PR)

**Test 3: Contributor PR with Passing CI Merges**
1. Create a PR with valid code (passes all checks)
2. CI runs and passes
3. Merge button is **enabled**
4. Verify merge succeeds

### Architecture Requirements Met

From **Architecture Decision Document:**

| Requirement | Status |
|---|---|
| "Security requirements around...branch protection..." | ✅ Addressed in Story 1.2 |
| "Repository branch protection enforces required checks before merge to protected branches" (NFR7) | ✅ Configured here |
| "Use GitHub Actions as the authoritative CI gate before protected branch merges" | ✅ Story 1.2 selects CI jobs as required checks |

---

## Tasks / Subtasks

- [ ] **Verify CI Workflow Exists** (from Story 1.1 or Epic 4 Story 1)
  - [ ] Check `.github/workflows/` for a CI workflow file (e.g., `ci.yaml`, `lint-and-build.yaml`)
  - [ ] Identify the workflow job names (e.g., `lint`, `typecheck`, `build`)
  - [ ] If CI workflow doesn't exist yet, coordinate with parallel Epic 4 Story 1 work

- [ ] **Enable Branch Protection Rule on `main`**
  - [ ] Navigate to repository **Settings → Branches**
  - [ ] Click **Add rule** (or edit existing rule if present)
  - [ ] Enter branch name pattern: `main`
  - [ ] Check **"Require status checks to pass before merging"**
  - [ ] Select at least one CI workflow job (e.g., `CI / lint`, `CI / typecheck`, or `CI / build`)

- [ ] **Configure Admin Bypass**
  - [ ] Check **"Allow force pushes"** → select **"Allow all"** or **"Dismiss pull request reviews"**
  - [ ] Verify **"Restrict who can push to matching branches"** is unchecked (allow maintainers to push directly)
  - [ ] Check that **"Allow deletions"** is unchecked (prevent accidental branch deletion)

- [ ] **Configure PR & Merge Behavior**
  - [ ] Leave **"Require pull request review"** unchecked (Phase 1 scope: CI gates only)
  - [ ] Leave **"Require branches to be up to date"** unchecked (optimization for Phase 1)
  - [ ] Leave **"Require conversation resolution"** unchecked (deferred to Phase 2)
  - [ ] Enable **"Automatically delete head branches"** (cleanup after merge)

- [ ] **Test Branch Protection**
  - [ ] Create a test PR that **fails CI** (e.g., introduce a linting error)
  - [ ] Verify merge button is **blocked** with appropriate error message
  - [ ] Make a direct commit as maintainer (admin) and `git push origin main`
  - [ ] Verify maintainer **push succeeds** without requiring a PR
  - [ ] Create a test PR that **passes CI** (fix the linting error)
  - [ ] Verify merge button is **enabled**
  - [ ] Merge the PR and verify it succeeds

- [ ] **Document in CONTRIBUTING.md** (if exists from Story 1.4)
  - [ ] Add a brief note: "All PRs to `main` require passing CI checks (lint, typecheck, build)"
  - [ ] Add: "Maintainers can push directly to `main` if needed for urgent fixes"

---

## Dev Notes

### Important Implementation Details

#### 1. **CI Workflow Must Exist First**

The branch protection rule requires at least one **required status check**. These are GitHub Actions job outcomes. If no CI workflow exists yet, you have two options:

**Option A: Parallel Work (Recommended)**
- Story 1.2 (this story) configures the rule and selects a CI job
- Epic 4 Story 1 (CI Validation Workflow) defines the workflow
- Both can happen in parallel, as long as the CI workflow exists *before* you try to merge a PR after branch protection is enabled

**Option B: Deferred Rule Configuration**
- Complete Story 1.1 and verify CI workflow is running
- Then complete Story 1.2

For Phase 1, **Option A** is acceptable because Story 1.1 already has linting/type-checking set up.

#### 2. **GitHub UI vs. Terraform vs. API**

This story uses the **GitHub UI** for simplicity and transparency in Phase 1.

**Phase 2 (Story 2.1: Terraform GitHub Infrastructure)** will move this to Infrastructure as Code using the `github_branch_protection` Terraform resource.

If you want to use the REST API directly, the endpoint is:
```
PUT /repos/{owner}/{repo}/branches/main/protection
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["CI / lint", "CI / typecheck", "CI / build"]
  },
  "enforce_admins": false,
  "allow_force_pushes": true,
  "allow_deletions": false
}
```

#### 3. **Required Status Check Names**

GitHub uses the format `{workflow_name} / {job_name}` or `{check_app_name}` for required status checks.

Common examples:
- `CI / lint` (workflow name: "CI", job name: "lint")
- `GitHub Actions / build` (workflow: "GitHub Actions", job: "build")

From Story 1.1, the likely CI workflow jobs are:
- `lint` (Biome)
- `typecheck` (TypeScript)
- `build` (Vite)
- `test` (Vitest, if tests exist)

**Verify the exact names by:**
1. Check `.github/workflows/ci.yaml` (or equivalent) for the `jobs:` section
2. Look at the workflow job `name:` field (e.g., `name: "lint"`)
3. Or wait for a PR to run CI and see the status check name in GitHub UI

#### 4. **Force Push Settings: Detailed Breakdown**

The **"Allow force pushes"** setting has three options:

| Option | Effect | Use Case |
|---|---|---|
| **Dismiss pull requests** | Admins can force-push; non-admins cannot | Recommended for mature projects with review culture |
| **Allow all** | Everyone can force-push (only within their own branches) | Fast iteration during development; Phase 1 preference |
| **Disabled** | No one can force-push (except through PR merge) | Strict audit trail; not needed in Phase 1 |

For Phase 1: Select **"Allow all"** to keep development fast. Force-pushes on `main` itself still require admin privileges (maintainer-only).

#### 5. **"Require branches to be up to date" Setting**

This option forces a branch to be rebased on `main` before merge, triggering another CI run.

**Phase 1 Setting: Disabled**

Rationale:
- Causes extra CI runs during concurrent PR work (bottleneck in high-velocity sprints)
- Not essential for Phase 1's quality gate (CI already runs on the PR branch)
- Can be enabled in Phase 2 if CI consistency becomes critical

#### 6. **Dismiss Stale Approvals**

Even though Phase 1 is not using manual approvals yet, the setting **"Dismiss stale pull request approvals when new commits are pushed"** is good practice and should be **enabled**.

It ensures that if a contributor pushes new changes to address feedback, the review state resets (ready for re-review in Phase 2).

#### 7. **Testing Branch Protection (Important)**

Do NOT skip testing. It's easy to misconfigure a rule and accidentally block valid merges or allow invalid ones.

**Test Plan:**
1. Create a test PR with a linting violation (e.g., unused variable, bad formatting)
2. Push to the PR branch
3. Wait for CI to fail
4. Attempt merge → should be **blocked** with clear message
5. Fix the violation, push again
6. Wait for CI to pass
7. Attempt merge → should be **enabled** and succeed
8. After merge, verify head branch is auto-deleted (if enabled)

### File Structure & References

No new files are created by this story. Branch protection is a repository-level GitHub setting.

**Related files:**
- `.github/workflows/` — CI workflow (from Story 1.1 or Epic 4 Story 1)
- `CONTRIBUTING.md` — Optional: add note about required CI checks (from Story 1.4)

### Previous Story Context

From **Story 1.1 (Reconcile Frontend Baseline)**:
- Biome linter is installed and passing (`npm run lint`)
- TypeScript checks pass (`npm run typecheck`)
- Build succeeds (`npm run build`)
- These form the basis for the required status checks in this story

No learnings or breaking changes from Story 1.1 that affect Story 1.2.

---

## Project Structure Notes

**No new project files are created.** Story 1.2 is a pure GitHub configuration task.

The branch protection rule is applied in GitHub's repository settings, not in code.

---

## Architecture Compliance

### GitHub Actions as Authoritative CI Gate

From **Architecture Decision Document**, section "Core Architectural Decisions":

> "Use GitHub Actions as the authoritative CI gate before protected branch merges"

**Story 1.2 implements this** by:
1. Selecting GitHub Actions workflow jobs as required status checks
2. Enforcing that PRs cannot merge until those jobs pass
3. Allowing admin bypass for emergency maintainer pushes

### Security & Integrity Requirements

From **Epic 1 Requirements**:

| Requirement | How Story 1.2 Addresses It |
|---|---|
| NFR7: "Repository branch protection enforces required checks before merge" | ✅ Configure required status checks on `main` |
| Security: Prevent broken code reaching production | ✅ Block merge if CI fails |
| Security: Maintainer emergency pushes | ✅ Allow force-push for admins |
| Quality: Consistent validation workflow | ✅ All contributors use same CI gate |

---

## Verification Checklist

Before marking this story **done**, verify:

- [ ] Branch protection rule exists on `main` branch
- [ ] At least one required status check is selected (e.g., `CI / lint`)
- [ ] Force-pushes are allowed for admins
- [ ] Non-admin force-pushes are blocked
- [ ] Automatically delete head branches is enabled
- [ ] A PR with failed CI cannot be merged
- [ ] A maintainer can push directly to `main` without PR
- [ ] A PR with passed CI can be merged
- [ ] CONTRIBUTING.md is updated (if applicable) with CI gate note

---

## Session Context

**Story ID:** 1-2  
**Story Key:** `1-2-configure-branch-protection-rules`  
**Epic:** Epic 1 - Open-Source Repository Governance & Publication  
**Effort:** Small (1-2 hours of UI interaction + testing)  
**Blocker Status:** Depends on CI workflow from Story 1.1 or Epic 4 Story 1  
**Next Story:** 1-3 (Define Issue Labels for Triage)

---

## References

- **Epics Document:** [Planning Artifacts](../planning-artifacts/epics.md) — Epic 1, Story 1.2
- **Architecture:** [Architecture Decision Document](../planning-artifacts/architecture.md) — "Use GitHub Actions as authoritative CI gate"
- **Project Context:** [Project Context Rules](../project-context.md) — Tech stack and standards
- **GitHub Docs:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- **GitHub API Docs:** [Set repository branch protection](https://docs.github.com/en/rest/branches/branch-protection?apiVersion=2022-11-28#set-branch-protection)
- **Story 1.1:** [Reconcile Frontend Baseline](./1-1-reconcile-frontend-baseline-from-vite-react-typescript-starter.md) — Prior story providing CI foundation

---

**Status:** ready-for-dev  
**Created:** 2026-04-15  
**Last Updated:** 2026-04-15
