---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
  - step-e-epic7-testing-2026-04-19
inputDocuments:
  - /Users/lorenzogm/lorenzogm/bmad-ui/_bmad-output/planning-artifacts/prd.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/_bmad-output/planning-artifacts/architecture.md
---

# bmad-ui - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-ui Phase 1, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Maintainer can publish bmad-ui as a public repository.
FR2: Maintainer can define repository governance rules for protected branches and required checks.
FR3: Maintainer can define project metadata and repository configuration as managed artifacts.
FR4: Maintainer can define and maintain issue labels for triage workflows.
FR5: Contributor can understand contribution expectations from repository-level guidance.
FR6: Maintainer can provision and manage GitHub repository infrastructure through declarative configuration.
FR7: Maintainer can provision and manage deployment infrastructure through declarative configuration.
FR8: Maintainer can apply infrastructure changes across environments with minimal manual steps.
FR9: Maintainer can import and reconcile existing infrastructure into managed state.
FR10: Maintainer can separate development and production environment configuration.
FR11: Maintainer can manage project secrets through a consistent encrypted workflow.
FR12: Contributor can run the project without direct access to production secret values.
FR13: Maintainer can define root-level secret management conventions for all workflows.
FR14: Maintainer can rotate and update secret values without redefining application capabilities.
FR15: Maintainer can validate that sensitive values are excluded from public source artifacts.
FR16: Maintainer can trigger automated validation workflows on repository changes.
FR17: Maintainer can enforce quality gates before protected branch integration.
FR18: Maintainer can run a standard dependency and script workflow using the project's package management standard.
FR19: Maintainer can trigger deployment workflows tied to approved repository events.
FR20: Maintainer can observe workflow outcomes and identify failing stages.
FR21: Contributor can validate contributions against the same automated checks used by maintainers.
FR22: Contributor can install and run the project using pnpm as the canonical package manager.
FR23: Contributor can execute a standard local workflow from VS Code.
FR24: Contributor can run linting and type validation through documented project commands.
FR25: Maintainer can define and enforce coding and formatting standards for contributors.
FR26: Maintainer can define monorepo workflow conventions for build and task orchestration.
FR27: Contributor can discover required setup steps from minimal quickstart documentation.
FR28: User can access bmad-ui as a visual companion to bmad orchestration workflows.
FR29: User can observe workflow flow and analysis context relevant to agentic development.
FR30: User can use bmad-ui in conjunction with backlog artifacts created in bmad workflows.
FR31: Maintainer can validate that bmad-ui supports development execution against epics and stories generated in backlog workflows.
FR32: User can interpret current project/workflow state through the UI without reading raw orchestration logs.
FR33: New user can complete local setup from repository documentation.
FR34: New user can complete deployment setup from repository documentation.
FR35: Support user can diagnose common setup and pipeline failures using documented troubleshooting guidance.
FR36: Contributor can submit documentation improvements when onboarding gaps are identified.
FR37: Maintainer can collect and review early adoption signals from public project interaction.
FR38: Maintainer can use Phase 1 outputs as baseline inputs for Phase 2 refactoring.
FR39: Maintainer can preserve a clear boundary between Phase 1 delivery and post-MVP feature expansion.
FR40: Maintainer can evolve the product toward advanced agentic capabilities without replacing foundational workflows.
FR41: Maintainer can automatically capture session-level outcome metrics (one-shot success, delivery, abort, correction count) from Copilot CLI and VS Code debug logs without manual annotation.
FR42: Maintainer can view per-skill and per-model effectiveness metrics to identify which combinations produce the best autonomous output.
FR43: Maintainer can compare session quality across model+skill combinations to inform autonomous workflow configuration decisions.
FR44: Maintainer can track session complexity indicators (context compactions, subagent spawns, tool distribution) to diagnose why sessions fail or require corrections.
FR45: Maintainer can export or generate an autonomous workflow configuration recommending optimal model assignments per skill based on historical session data.
FR46: Maintainer can run Playwright E2E tests that verify all existing UI routes render without JavaScript errors.
FR47: Maintainer can detect regressions in navigation, page rendering, and core user interactions through automated E2E tests executed on every change.
FR48: Contributor can run the full E2E test suite locally before submitting changes using a single documented command.
FR49: CI pipeline includes E2E test execution as a required quality gate before protected branch merge.
FR50: Maintainer can add new E2E test scenarios incrementally as features are developed without modifying existing test infrastructure.
FR51: E2E tests validate that data-dependent views (sessions, epics, analytics) render correctly with real project artifact data.
FR52: Maintainer can identify JavaScript runtime errors and broken user interactions through automated headless browser testing.

### NonFunctional Requirements

NFR1: Local setup validation commands complete in under 10 minutes on a standard developer machine with stable network.
NFR2: CI validation workflow completes within 15 minutes for standard pull requests.
NFR3: Core UI pages for flow/analysis views render initial usable state within 3 seconds under normal load.
NFR4: Documentation lookup for setup/deploy/troubleshooting enables users to find required steps within 2 navigation actions from README entry points.
NFR5: Secrets are never committed in plaintext to version control.
NFR6: Secret values are managed through dotenvx workflow with environment separation for development and production.
NFR7: Repository branch protection enforces required checks before merge to protected branches.
NFR8: Deployment credentials and tokens are scoped to least-privilege access needed for workflow execution.
NFR9: Sensitive infrastructure operations are auditable through repository and workflow history.
NFR10: Main-branch CI success rate is maintained at or above 95% over rolling 30 runs.
NFR11: Deployment pipeline provides deterministic outcomes for unchanged inputs.
NFR12: Infrastructure provisioning workflows include rollback/recovery guidance for failed apply or import operations.
NFR13: Required quality checks (lint, types, tests/build where applicable) must pass before protected branch integration.
NFR14: GitHub and Vercel infrastructure workflows must execute using documented Terraform procedures without undocumented manual intervention.
NFR15: Backlog-driven development loop (epics/stories to implementation execution) must be operable through the documented bmad + bmad-ui workflow.
NFR16: Tooling commands and automation are standardized on pnpm and produce consistent results across local and CI contexts.
NFR17: VS Code-first developer workflow is fully documented and sufficient for solo execution of setup, validation, and deployment tasks.
NFR18: CI/CD and repository workflow design supports at least 10 active pull requests per week without process bottlenecks requiring workflow redesign.
NFR19: Project structure and automation conventions support incremental adoption by additional contributors without changing core Phase 1 operating model.
NFR20: Public documentation uses clear structure and readable formatting suitable for broad developer audiences.
NFR21: Core UI views maintain keyboard-navigable interaction paths for primary workflows.
NFR22: New UI additions in Phase 1 do not reduce existing accessibility quality baseline of the application.
NFR23: Session sync daemon must process all historical sessions on startup within 30 seconds.
NFR24: Session quality metrics must be derivable entirely from local log files without network calls or external API dependencies.
NFR25: Analytics aggregation for model+skill effectiveness must handle at least 500 sessions without noticeable UI lag.
NFR26: E2E test suite completes within 5 minutes on CI for the full Playwright test matrix.
NFR27: All existing UI routes must have at least one E2E smoke test covering render-without-error verification.
NFR28: E2E tests run headless in CI and optionally headed locally using a single command-line flag.
NFR29: E2E test failures in CI block merge to protected branches with clear failure output identifying the broken route or interaction.

### Additional Requirements

_From Architecture — technical constraints that impact epic and story design:_

- Three-boundary architecture is mandatory: dashboard frontend, API/backend adapter layer, and orchestrator runtime. These must remain separated in all implementation work.
- **Starter Template Note (impacts Epic 1 Story 1):** Architecture selected Vite React TypeScript as the baseline. For this brownfield project, the first implementation story must NOT re-scaffold the package — it should reconcile the existing frontend package against the Vite React TypeScript baseline and layer project-specific conventions on top.
- File-based data architecture: no database in Phase 1. Orchestrator-produced JSON and log artifacts remain the durable source of truth.
- TanStack Query v5 is the mandatory frontend server-state layer — no `useEffect`-driven data fetching.
- REST + SSE is the required API communication pattern: REST for snapshot reads and mutations, SSE for live updates.
- All new routes must be manually registered in the TanStack Router route tree. No barrel files.
- Shared TypeScript contracts in `src/types.ts` are the single source of truth for frontend-consumed types — no duplication in route modules.
- Terraform 1.14.x is the infrastructure provisioning standard for GitHub and Vercel resources.
- GitHub Actions is the authoritative CI enforcement layer.
- Vercel is the deployment platform with GitHub-driven CI/CD.
- dotenvx-based encrypted environment workflow governs all secret management: local, CI, and production.
- pnpm is the mandatory package manager for all install, script, and CI operations. Lockfile consistency must be enforced in CI.
- Biome + TypeScript + Vitest form the automated code quality enforcement baseline.
- Adapter/API layer owns all validation and normalization of orchestrator output before it reaches frontend route components.
- No end-user authentication or authorization in Phase 1. Security boundary is operational: repository governance, deployment controls, and secret hygiene.
- Adapter/API layer physical package location is an open implementation detail — must be resolved in the first infrastructure and adapter-layer stories.

### UX Design Requirements

_No UX Design document was found for Phase 1. Phase 1 is infrastructure-focused; UI work is limited to operational validation of existing views._

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | Publish bmad-ui as public repository |
| FR2 | Epic 1 | Define governance rules for protected branches |
| FR3 | Epic 1 | Define project metadata as managed artifacts |
| FR4 | Epic 1 | Define and maintain issue labels |
| FR5 | Epic 1 | Contribution expectations from repo-level guidance |
| FR6 | Epic 2 | Provision GitHub repo infrastructure via Terraform |
| FR7 | Epic 2 | Provision Vercel deployment infrastructure via Terraform |
| FR8 | Epic 2 | Apply infra changes with minimal manual steps |
| FR9 | Epic 2 | Import and reconcile existing infrastructure into managed state |
| FR10 | Epic 2 | Separate dev and production environment configuration |
| FR11 | Epic 3 | Manage secrets through encrypted dotenvx workflow |
| FR12 | Epic 3 | Contributors work without production secret values |
| FR13 | Epic 3 | Root-level secret management conventions |
| FR14 | Epic 3 | Rotate secrets without redefining capabilities |
| FR15 | Epic 3 | Validate sensitive values excluded from source artifacts |
| FR16 | Epic 4 | Trigger automated validation workflows on repo changes |
| FR17 | Epic 4 | Enforce quality gates before protected branch merges |
| FR18 | Epic 4 | Standard pnpm dependency and script workflow in CI |
| FR19 | Epic 4 | Trigger deployment workflows on approved repo events |
| FR20 | Epic 4 | Observe workflow outcomes and identify failing stages |
| FR21 | Epic 4 | Contributors validate against same checks as maintainers |
| FR22 | Epic 5 | Install and run project using pnpm |
| FR23 | Epic 5 | Execute standard local workflow from VS Code |
| FR24 | Epic 5 | Run linting and type validation through project commands |
| FR25 | Epic 5 | Define and enforce coding/formatting standards |
| FR26 | Epic 5 | Install bmad-ui into any bmad project via npx |
| FR27 | Epic 5 | Discover required setup steps from quickstart docs |
| FR28 | Epic 8 | Access bmad-ui as visual companion to bmad workflows |
| FR29 | Epic 8 | Observe workflow flow and analysis context |
| FR30 | Epic 8 | Use bmad-ui with backlog artifacts from bmad |
| FR31 | Epic 8 | Validate bmad-ui supports execution from epics/stories |
| FR32 | Epic 8 | Interpret project/workflow state through UI |
| FR33 | Epic 6 | Complete local setup from repository documentation |
| FR34 | Epic 6 | Complete deployment setup from documentation |
| FR35 | Epic 6 | Diagnose common setup/pipeline failures from docs |
| FR36 | Epic 6 | Submit documentation improvements |
| FR37 | Epic 6 | Collect and review early adoption signals |
| FR38 | Epic 8 | Use Phase 1 outputs as Phase 2 baseline inputs |
| FR39 | Epic 8 | Preserve clear boundary between Phase 1 and post-MVP |
| FR40 | Epic 8 | Evolve toward advanced agentic capabilities |
| FR41 | Epic 10 | Auto-capture session outcome metrics from logs |
| FR42 | Epic 10 | View per-skill/per-model effectiveness metrics |
| FR43 | Epic 10 | Compare session quality across model+skill combos |
| FR44 | Epic 10 | Track session complexity indicators |
| FR45 | Epic 10 | Generate autonomous workflow configuration from data |
| FR46 | Epic 7 | Playwright E2E tests verify all routes render without JS errors |
| FR47 | Epic 7 | Detect regressions in navigation, rendering, interactions |
| FR48 | Epic 7 | Contributor runs full E2E suite locally with one command |
| FR49 | Epic 7 | CI includes E2E tests as merge gate |
| FR50 | Epic 7 | Incremental test scenarios without infra changes |
| FR51 | Epic 7 | Data-dependent views render correctly with real data |
| FR52 | Epic 7 | Identify JS errors via headless browser testing |
| AR1 | Epic 11 | Three-boundary architecture enforcement via modularization |
| AR2 | Epic 11 | Resolve adapter/API layer package location |
| AR3 | Epic 11 | Normalize API logic in adapter layer |
| AR6 | Epic 11 | Correct pattern violations at abstraction boundary |
| FR38 | Epic 11 | Phase 2 refactoring baseline (agent-server decomposition) |
| FR22 | Epic 12 | Install and run project using pnpm (updated paths) |
| FR26 | Epic 12 | Install bmad-ui into any bmad project via npx (fix install) |
| FR27 | Epic 12 | Discover required setup from quickstart docs (updated docs) |
| FR38 | Epic 12 | Phase 2 baseline (simplified structure for extensibility) |

## Epic List

### Epic 1: Open-Source Repository Governance & Publication
Maintainer can publish bmad-ui as a professional, governed public open-source repository with branch protections, labels, contribution guidelines, and project metadata all in place.
**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: Infrastructure Provisioning via Terraform
Maintainer can provision and fully manage GitHub repository and Vercel deployment infrastructure through declarative Terraform configuration with minimal manual steps, including import and reconciliation of existing state.
**FRs covered:** FR6, FR7, FR8, FR9, FR10

### Epic 3: Secrets & Environment Management
Maintainers and contributors can safely manage secrets through dotenvx with environment separation — no plaintext secrets in source control, contributors can work without production values.
**FRs covered:** FR11, FR12, FR13, FR14, FR15

### Epic 4: CI/CD Pipeline & Quality Gates
Maintainers and contributors can trigger automated validation and deployment workflows on repository changes, with enforced quality gates before protected branch merges and observable pipeline outcomes.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21

### Epic 5: Portable Installation & Developer Tooling
Any bmad user can add bmad-ui to an existing bmad project with a single command (`npx bmad-method-ui install`) — no monorepo, no global setup. The app lives entirely under `_bmad-ui` and is self-contained. Contributors can install, run, lint, type-check, and build using npm with Biome and TypeScript conventions enforced.
**FRs covered:** FR22, FR23, FR24, FR25, FR27

### Epic 6: Onboarding, Documentation & Adoption Enablement
New users can complete local setup and deployment from repository documentation in under 15 minutes; support users can diagnose common failures from a troubleshooting guide; contributors can submit improvements; maintainer can observe early adoption signals.
**FRs covered:** FR33, FR34, FR35, FR36, FR37

### Epic 7: End-to-End Testing & Regression Safety
Maintainer and contributors can run Playwright E2E tests that verify all existing UI routes render without errors, detect regressions in navigation and interactions, and gate merges through automated CI checks — enabling safe iteration without breaking production functionality.
**FRs covered:** FR46, FR47, FR48, FR49, FR50, FR51, FR52
**NFRs addressed:** NFR26, NFR27, NFR28, NFR29

### Epic 8: Core Product Operation & Phase Readiness Validation
Users can access bmad-ui as a working visual companion to bmad orchestration workflows, observing flow and analysis context without reading raw logs. Maintainer can validate the self-referential execution loop, establishing the Phase 2 baseline.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR38, FR39, FR40

### Epic 9: UI Improvements & Polish
Users experience a polished, responsive bmad-ui with improved empty states, loading skeletons, navigation clarity, and accessible status indicators — making the tool feel production-ready and easy to use daily.

### Epic 10: Session Analytics & Autonomous Workflow Optimization
Maintainer can observe rich session-level quality metrics (one-shot success, delivery rate, corrections, aborts, complexity indicators) aggregated by skill and model, enabling data-driven selection of optimal model+skill combinations for autonomous agent workflows.
**FRs covered:** FR41, FR42, FR43, FR44, FR45

### Epic 11: Agent Server Modularization
Maintainers and AI agents can work on the API/backend adapter layer as a set of focused, domain-collocated modules — each domain in its own folder with collocated types, constants, Zod schemas, and functions — instead of a single 4,883-line monolith, enabling faster iteration, safer concurrent modifications, and proper separation of concerns mandated by the architecture.
**Architecture requirements covered:** AR1, AR2, AR3, AR6, AR7
**FRs reinforced:** FR38, FR39
**NFRs reinforced:** NFR13, NFR19

### Epic 12: Project Structure Simplification & npm Package Fix
Users and contributors can work with a cleaner `_bmad-ui/` directory layout where the app lives at the top level (no nested `bmad-ui/bmad-ui`), data files are organized under `artifacts/`, and `npx bmad-method-ui install` correctly downloads and installs the app into any bmad project.
**FRs reinforced:** FR22, FR26, FR27, FR38
**NFRs reinforced:** NFR16, NFR19

---

## Epic 1: Repository Bootstrap & Governance Scaffold

Maintainer can publish bmad-ui as a professional, governed public open-source repository with branch protections, labels, contribution guidelines, and project metadata all in place.

**Story to FR mapping:**
- Story 1.1 -> FR1, FR3
- Story 1.2 -> FR2
- Story 1.3 -> FR4
- Story 1.4 -> FR5

### Story 1.1: Reconcile Frontend Baseline from Vite React TypeScript Starter

As a maintainer,
I want to reconcile the existing frontend package against the Vite React TypeScript starter baseline and set essential repository metadata,
So that Phase 1 starts from an architecture-aligned baseline without re-scaffolding and the public repository context is clear.

**Acceptance Criteria:**

**Given** the architecture starter guidance,
**When** Story 1.1 is implemented,
**Then** the existing frontend package is reconciled to the Vite React TypeScript baseline without re-scaffolding the project

**Given** the repository exists on GitHub,
**When** a visitor opens it,
**Then** it has a populated description, homepage URL, topics/tags, and correct public visibility

**Given** the repository settings,
**When** inspected,
**Then** default branch is set to `main`, issues are enabled, and discussions are enabled

**Given** the repository,
**When** a maintainer reviews it,
**Then** a `LICENSE` file (MIT) and `.github/` directory are present at repo root

### Story 1.2: Configure Branch Protection Rules

As a maintainer,
I want branch protection rules configured on `main` that enforce CI checks on PRs while allowing maintainer direct pushes,
So that the branch stays protected for contributors without blocking my own workflow.

**Acceptance Criteria:**

**Given** a pull request to `main`,
**When** CI checks are not passing,
**Then** the merge button is blocked

**Given** the branch protection rules,
**When** reviewed,
**Then** force-pushes from non-admins are disabled and at least 1 required status check is configured

**Given** the maintainer (admin),
**When** pushing directly to `main`,
**Then** the push succeeds without requiring a PR

### Story 1.3: Define Issue Labels for Triage

As a maintainer,
I want a standard set of issue labels defined in the repository,
So that issues and PRs can be triaged consistently.

**Acceptance Criteria:**

**Given** the repository labels,
**When** listing them,
**Then** labels exist for at minimum: `bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`, `question`, `wontfix`

**Given** each label,
**When** viewed,
**Then** it has a distinct color and a short description

**Given** the labels,
**When** a new contributor opens an issue,
**Then** labels are immediately available to apply

### Story 1.4: Add Basic Contribution Guidance

As a contributor,
I want minimal contribution guidance available in the repository,
So that I understand the basics of how to contribute without extensive documentation overhead.

**Acceptance Criteria:**

**Given** the repository root,
**When** a contributor visits it,
**Then** the README includes a short "Contributing" section covering how to open issues and submit PRs

**Given** the `.github/` directory,
**When** viewed,
**Then** a `CONTRIBUTING.md` exists with at minimum: local setup reference, branch naming convention, and PR submission steps

**Given** the `CONTRIBUTING.md`,
**When** read,
**Then** it is under 100 lines and focused on essential steps only

---

## Epic 2: Infrastructure Provisioning via Terraform

Maintainer can provision and fully manage GitHub repository and Vercel deployment infrastructure through declarative Terraform configuration with minimal manual steps, including import and reconciliation of existing state.

**Story to FR mapping:**
- Story 2.1 -> FR6, FR8, FR9
- Story 2.2 -> FR7, FR19, FR20
- Story 2.3 -> FR10

### Story 2.1: Terraform GitHub Repository Infrastructure

As a maintainer,
I want the bmad-ui GitHub repository configuration managed as Terraform code,
So that repository settings, branch protections, and labels are reproducible and version-controlled.

**Acceptance Criteria:**

**Given** the Terraform config in the repo,
**When** `terraform apply` is run,
**Then** it provisions or updates repository settings, branch protections, and labels without manual GitHub UI intervention

**Given** an existing GitHub repo,
**When** `terraform import` is run for the repo resource,
**Then** the resource is successfully reconciled into managed Terraform state

**Given** the Terraform state,
**When** reviewed,
**Then** it reflects current repository configuration as source of truth

### Story 2.2: GitHub Actions Deployment Pipeline

As a maintainer,
I want deployment to be executed through GitHub Actions workflows,
So that releases are automated, auditable, and consistent across environments.

**Acceptance Criteria:**

**Given** a push or merge to the configured deployment branch,
**When** the deploy workflow is triggered,
**Then** GitHub Actions builds and deploys bmad-ui successfully

**Given** deployment secrets are required,
**When** the workflow runs,
**Then** it reads required credentials from GitHub Secrets and does not expose secret values in logs

**Given** a failed deployment step,
**When** the workflow completes,
**Then** the run is marked failed with clear stage-level logs for diagnosis

**Given** a successful deployment,
**When** maintainers review the run,
**Then** deployment status and environment target are visible in the workflow summary

### Story 2.3: Environment Separation Across Infra and Deploy Workflows

As a maintainer,
I want development, preview, and production configuration separated across Terraform and GitHub Actions,
So that changes to one environment do not unintentionally affect the others.

**Acceptance Criteria:**

**Given** the Terraform workspace or variable file structure,
**When** reviewed,
**Then** dev and production infra configurations are in distinct variable sets or workspaces

**Given** the deployment workflow configuration,
**When** reviewed,
**Then** preview and production deploy jobs are clearly separated with explicit branch or environment targeting

**Given** a deployment workflow run,
**When** executed for preview,
**Then** it cannot deploy to production unless production-specific conditions are satisfied

**Given** the infra and deployment runbook,
**When** read,
**Then** plan, apply, import, and deploy flow per environment is documented end-to-end

---

## Epic 3: Secrets & Environment Management

Maintainers and contributors can safely manage secrets through dotenvx with environment separation - no plaintext secrets in source control, contributors can work without production values.

**Story to FR mapping:**
- Story 3.1 -> FR11, FR13
- Story 3.2 -> FR12
- Story 3.3 -> FR14, FR15

### Story 3.1: Establish Root-Level dotenvx Secret Workflow

As a maintainer,
I want a standardized dotenvx workflow at repository root,
So that all environments use a consistent encrypted secrets process.

**Acceptance Criteria:**

**Given** the repository root,
**When** checked,
**Then** dotenvx config and encrypted env files are present and documented for local and CI usage

**Given** a maintainer onboarding flow,
**When** followed,
**Then** required steps to encrypt, decrypt, and load environment variables are explicit and reproducible

**Given** secret files in git,
**When** reviewed,
**Then** only encrypted secret artifacts are tracked and plaintext secret files are excluded

### Story 3.2: Enable Contributor Workflow Without Production Secrets

As a contributor,
I want to run and validate the project without production secret access,
So that I can contribute safely without privileged credentials.

**Acceptance Criteria:**

**Given** a contributor setup,
**When** running locally,
**Then** a documented dev-only secret set is sufficient to start and validate core workflows

**Given** missing production values,
**When** contributor commands run,
**Then** they fail gracefully only where production access is required and include clear guidance

**Given** contributor docs,
**When** read,
**Then** they clearly separate required local secrets from restricted production secrets

### Story 3.3: Secret Rotation and Audit-Safe Handling

As a maintainer,
I want to rotate secrets and verify they are never exposed in source or logs,
So that credential hygiene remains strong over time.

**Acceptance Criteria:**

**Given** a secret rotation event,
**When** values are updated,
**Then** deployment and CI pipelines continue operating after updating encrypted sources and GitHub Secrets

**Given** CI workflow runs,
**When** logs are inspected,
**Then** secret values are masked and not echoed

**Given** repository history and configuration review,
**When** scanned,
**Then** no plaintext secrets are present in tracked files

**Given** the operations runbook,
**When** consulted,
**Then** rotation and rollback procedures are documented

---

## Epic 4: CI/CD Pipeline & Quality Gates

Maintainers and contributors can trigger automated validation and deployment workflows on repository changes, with enforced quality gates before protected branch merges and observable pipeline outcomes.

**Story to FR mapping:**
- Story 4.1 -> FR16, FR18, FR21
- Story 4.2 -> FR17
- Story 4.3 -> FR19
- Story 4.4 -> FR20

### Story 4.1: Create CI Validation Workflow

As a maintainer,
I want a GitHub Actions CI workflow that runs on pull requests and key branch updates,
So that code quality is automatically validated before integration.

**Acceptance Criteria:**

**Given** a pull request is opened or updated,
**When** CI runs,
**Then** it executes install, lint, typecheck, and test or build checks using pnpm

**Given** CI is configured,
**When** dependencies are installed,
**Then** lockfile consistency is enforced to prevent environment drift

**Given** CI completion,
**When** checks fail,
**Then** the workflow is marked failed with clear job-level logs

### Story 4.2: Enforce Protected Branch Quality Gates

As a maintainer,
I want required status checks enforced on protected branches,
So that only validated changes are merged.

**Acceptance Criteria:**

**Given** branch protection settings,
**When** a pull request to main has failing required checks,
**Then** merge is blocked

**Given** required checks are configured,
**When** a contributor submits a pull request,
**Then** the same validation gate applies to all contributors

**Given** protection rules are reviewed,
**When** audited,
**Then** required checks are explicitly tied to CI workflow jobs

### Story 4.3: Implement Deployment Workflow Triggers

As a maintainer,
I want deployment workflows triggered from approved repository events,
So that releases are automated and consistent.

**Acceptance Criteria:**

**Given** configured deployment branches or events,
**When** an approved event occurs,
**Then** deploy workflow starts automatically

**Given** preview and production deployment paths,
**When** workflows run,
**Then** target environment is explicit in workflow definition and logs

**Given** deployment workflow prerequisites are not met,
**When** the run starts,
**Then** deployment halts before release and reports the failed gate clearly

### Story 4.4: Add Workflow Observability and Failure Diagnosis

As a maintainer,
I want actionable visibility into CI and deployment workflow outcomes,
So that I can quickly identify and fix failing stages.

**Acceptance Criteria:**

**Given** any CI or deployment run,
**When** viewed in GitHub Actions,
**Then** workflow, job, and step status are clearly visible

**Given** a failed run,
**When** opened,
**Then** the failure point and relevant logs are available without requiring local reproduction first

**Given** successful runs,
**When** reviewed,
**Then** artifact, version, and environment context is visible in run summaries where applicable

---

## Epic 5: Portable Installation & Developer Tooling

Any bmad user can add bmad-ui to an existing bmad project with a single command (`npx bmad-method-ui install`) — no monorepo, no global setup. The app lives entirely under `_bmad-ui` and is self-contained. Contributors can install, run, lint, type-check, and build using npm with Biome and TypeScript conventions enforced.

**Story to FR mapping:**
- Story 5.1 -> FR22, FR27
- Story 5.2 -> FR24, FR25
- Story 5.3 -> FR23

### Story 5.1: Create `npx bmad-method-ui install` CLI

As a bmad user,
I want to run `npx bmad-method-ui install` in my bmad project,
So that bmad-ui is added to my project's `_bmad-ui` folder instantly without manual copying or monorepo setup.

**Acceptance Criteria:**

**Given** any directory containing a bmad project,
**When** `npx bmad-method-ui install` is run,
**Then** the `_bmad-ui` app is copied into the current directory with all source files intact and a printed next-steps message is shown

**Given** the install completes,
**When** the user follows the printed next steps,
**Then** they can run `cd _bmad-ui && npm install && npm run dev` to start the UI

**Given** the npm package is published,
**When** a user runs `npx bmad-method-ui install`,
**Then** it fetches the latest version of bmad-ui without requiring git clone or manual file copying

**Given** an existing `_bmad-ui` directory,
**When** install is run again,
**Then** the CLI warns the user before overwriting and requires explicit confirmation

**Given** a successful install,
**When** the user opens `_bmad-ui`,
**Then** the folder is fully self-contained: no external workspace dependencies, no monorepo tooling required

### Story 5.2: Enforce Code Quality Tooling Baseline

As a maintainer,
I want Biome and TypeScript quality standards enforced,
So that contributors follow consistent formatting and typing rules.

**Acceptance Criteria:**

**Given** source files,
**When** lint and format checks run,
**Then** Biome rules are applied consistently

**Given** TypeScript validation,
**When** typecheck runs,
**Then** strictness settings and path aliases align with project configuration

**Given** a pull request,
**When** quality checks run in CI,
**Then** violations fail the pipeline with actionable diagnostics

### Story 5.3: Provide VS Code-First Developer Workflow

As a contributor,
I want a clear VS Code-oriented setup and workflow guide,
So that I can become productive quickly in the preferred environment.

**Acceptance Criteria:**

**Given** the docs,
**When** onboarding from scratch,
**Then** required VS Code setup steps and common commands are clearly documented

**Given** the recommended workflow,
**When** followed,
**Then** contributors can run development and validation loops without extra tooling assumptions

**Given** troubleshooting needs,
**When** common setup issues occur,
**Then** docs provide quick resolution steps or links to the right section

---

## Epic 6: Onboarding, Documentation and Adoption Enablement

New users can complete local setup and deployment from repository documentation in under 15 minutes, support users can diagnose common failures from a troubleshooting guide, contributors can submit improvements, and maintainers can observe early adoption signals.

**Story to FR mapping:**
- Story 6.1 -> FR33
- Story 6.2 -> FR34
- Story 6.3 -> FR35
- Story 6.4 -> FR36
- Story 6.5 -> FR37

### Story 6.1: Publish Fast Local Setup Guide

As a new user,
I want a concise local setup quickstart,
So that I can run bmad-ui in under 15 minutes.

**Acceptance Criteria:**

**Given** the repository README,
**When** a new user follows quickstart steps,
**Then** local setup is completable without undocumented prerequisites

**Given** quickstart steps,
**When** executed,
**Then** required commands, environment preparation, and verification checks are explicit

**Given** a setup failure,
**When** encountered,
**Then** quickstart links to troubleshooting guidance for recovery

### Story 6.2: Publish Deployment Setup Guide

As a new user,
I want clear deployment setup instructions,
So that I can deploy bmad-ui reliably.

**Acceptance Criteria:**

**Given** deployment documentation,
**When** followed,
**Then** setup steps cover environment requirements, secrets prerequisites, and deployment workflow triggers

**Given** preview and production deployment paths,
**When** documented,
**Then** differences and safeguards are explicit

**Given** a deployment issue,
**When** encountered,
**Then** docs point to actionable diagnostics in workflow logs

### Story 6.3: Create Troubleshooting Matrix for Common Failures

As a support user,
I want a troubleshooting matrix for common setup and pipeline failures,
So that I can diagnose and resolve issues quickly.

**Acceptance Criteria:**

**Given** common failure categories,
**When** documented,
**Then** at minimum secrets, CI validation, deployment, and local runtime issues are covered

**Given** each failure category,
**When** reviewed,
**Then** symptoms, likely causes, and resolution steps are listed

**Given** unresolved issues,
**When** users escalate,
**Then** docs include what evidence to collect, including logs, command output, and workflow run links

### Story 6.4: Define Documentation Contribution Path

As a contributor,
I want a simple path to submit documentation improvements,
So that onboarding gaps can be fixed quickly.

**Acceptance Criteria:**

**Given** contribution docs,
**When** reviewed,
**Then** there is a clear process for proposing documentation updates

**Given** a docs pull request,
**When** submitted,
**Then** expected review criteria are explicit and lightweight

**Given** recurring onboarding issues,
**When** identified,
**Then** maintainers can point contributors to the docs update process

### Story 6.5: Capture Early Adoption Signals

As a maintainer,
I want lightweight adoption signal tracking,
So that I can evaluate traction and prioritize improvements.

**Acceptance Criteria:**

**Given** the public repository,
**When** monitored,
**Then** key signals are tracked, including stars, forks, issues, discussions, and first-time contributors

**Given** periodic review,
**When** performed,
**Then** signals are summarized in a simple cadence, such as weekly notes

**Given** trend changes,
**When** identified,
**Then** maintainers can map signals to follow-up actions in backlog planning

---

## Epic 7: End-to-End Testing & Regression Safety

Maintainer and contributors can run Playwright E2E tests that verify all existing UI routes render without errors, detect regressions in navigation and interactions, and gate merges through automated CI checks — enabling safe iteration without breaking production functionality.

**Story to FR mapping:**
- Story 7.1 -> FR46, FR48, FR50
- Story 7.2 -> FR46, FR47, FR52
- Story 7.3 -> FR51, FR47
- Story 7.4 -> FR49, FR47
- Story 7.5 -> FR47, FR50, FR51, FR52

### Story 7.1: Set Up Playwright Infrastructure and First Smoke Tests

As a maintainer,
I want Playwright installed and configured with smoke tests for the home page and navigation,
So that I have a working E2E test foundation I can run locally with a single command.

**Acceptance Criteria:**

**Given** the bmad-ui project has no E2E testing infrastructure,
**When** Story 7.1 is implemented,
**Then** Playwright is installed as a dev dependency with `@playwright/test`
**And** a `playwright.config.ts` exists at the project root with headless mode by default and a headed flag (`--headed`)
**And** a `tests/` directory exists with at least one test file
**And** `pnpm exec playwright test` runs successfully from `_bmad-ui`
**And** a `check:e2e` script is added to package.json

**Given** the dev server is running,
**When** the first smoke test executes,
**Then** it navigates to the home page (`/`) and verifies the page renders without JavaScript errors
**And** it verifies the main navigation links (Home, Sessions, Workflow, Analytics) are present in the DOM
**And** each navigation link can be clicked and the target route renders without errors

**Given** a contributor wants to run E2E tests locally,
**When** they execute `pnpm run check:e2e`,
**Then** the dev server starts automatically (via Playwright webServer config), tests run headless, and results are reported to stdout
**And** the test can optionally run headed with `pnpm run check:e2e -- --headed`

### Story 7.2: Complete Route Smoke Coverage

As a maintainer,
I want every registered route to have a smoke test verifying it renders without errors,
So that I can detect rendering regressions across the entire application after any change.

**Acceptance Criteria:**

**Given** Playwright infrastructure from Story 7.1 is in place,
**When** Story 7.2 is implemented,
**Then** smoke tests exist for ALL registered routes in the route tree:
- `/` (home)
- `/sessions`
- `/sessions/:sessionId` (at least one valid session)
- `/epics/:epicId` (at least one valid epic)
- `/stories/:storyId` (at least one valid story)
- `/prepare-story/:storyId` (at least one valid story)
- `/improvement-workflow`
- `/workflow` (index)
- `/workflow/:phaseId` (at least one valid phase)
- `/analytics` (dashboard)
- `/analytics/epics`
- `/analytics/epics/:epicId`
- `/analytics/stories`
- `/analytics/stories/:storyId`
- `/analytics/sessions`
- `/analytics/models`
- `/analytics/models/:modelId`

**Given** any route smoke test runs,
**When** the page loads,
**Then** the test verifies no JavaScript console errors occurred
**And** the test verifies the page is not showing a blank screen or error boundary
**And** the test verifies at least one meaningful content element is visible (heading, data table, or content panel)

**Given** a new route is added to the route tree in the future,
**When** it has no corresponding smoke test,
**Then** a test utility or documented convention guides the developer to add one

### Story 7.3: Data-Dependent View Validation

As a maintainer,
I want E2E tests that verify data-dependent views render correctly with real project artifact data,
So that I can confirm sessions, epics, and analytics pages work with actual bmad-ui data files.

**Acceptance Criteria:**

**Given** the project has real artifact data (agents-sessions.json, epics.md, story spec files),
**When** data-dependent E2E tests run,
**Then** the Sessions page (`/sessions`) renders the sessions table with at least one row
**And** clicking a session row navigates to the session detail page that renders without errors

**Given** the project has epics.md with epic data,
**When** the Epic detail test runs,
**Then** the epic detail page shows the epic title, goal, and at least one story listed

**Given** the analytics dashboard exists,
**When** analytics E2E tests run,
**Then** the analytics dashboard renders at least one chart or metric widget
**And** the analytics epics page renders a list of epics with progress data
**And** the analytics sessions page renders the sessions data table

**Given** a data file is malformed or missing,
**When** the affected page loads,
**Then** the page displays a graceful empty state or error message rather than a blank screen or unhandled exception

### Story 7.4: CI Integration and Merge Gating

As a maintainer,
I want E2E tests to run automatically in CI on every pull request and block merges on failure,
So that regressions are caught before they reach the protected branch.

**Acceptance Criteria:**

**Given** a GitHub Actions CI workflow exists (from Epic 4),
**When** Story 7.4 is implemented,
**Then** a new CI job (or step within the existing workflow) runs `pnpm run check:e2e` after lint+types+unit tests pass
**And** Playwright browsers are installed in CI via `pnpm exec playwright install --with-deps chromium`
**And** the E2E job uses the Chromium browser only in CI (not the full browser matrix)

**Given** the E2E tests pass in CI,
**When** the PR check results are reported,
**Then** the E2E status check shows green and the PR is mergeable

**Given** any E2E test fails in CI,
**When** the PR check results are reported,
**Then** the E2E status check shows red and the PR is blocked from merging
**And** the CI output clearly identifies which test file, test name, and route failed
**And** Playwright HTML report or trace artifacts are uploaded for debugging

**Given** the `check` script in package.json,
**When** it is updated for Story 7.4,
**Then** `pnpm run check` includes E2E tests in the pipeline: `check:lint && check:types && check:tests && check:e2e && build`

### Story 7.5: Deep E2E Coverage for Workflow Actions and Session Traces

As a maintainer,
I want deterministic E2E coverage for current workflow actions, artifact sync, and session traces,
So that broken `Plan all stories`, `Develop all stories`, story-sync, and session-log behaviors are caught before they ship.

**Acceptance Criteria:**

**Given** the current Playwright suite is mostly smoke coverage,
**When** Story 7.5 is implemented,
**Then** the E2E suite adds deterministic interaction scenarios for existing Phase 1 features beyond page-load checks
**And** those scenarios can run locally and in CI without depending on live Copilot responses

**Given** an epic contains a mix of planned-only, ready, in-progress, and done stories,
**When** the suite exercises the epic detail page and its action paths (`Plan all stories`, `Develop all stories`, and the per-story prepare/start flow),
**Then** only eligible stories are targeted
**And** state transitions become visible in the UI
**And** the tests fail if already-created stories are re-planned, bulk orchestration silently stalls, or action failures are hidden behind no-op behavior

**Given** `epics.md`, `sprint-status.yaml`, and runtime session data can change independently,
**When** the suite loads the home, epic detail, story detail, and workflow-connected views against real and intentionally mismatched artifact states,
**Then** planned stories, story counts, story statuses, and story-to-session links remain consistent
**And** visible warnings or empty states appear instead of silent inconsistency

**Given** session detail depends on synthesized log data,
**When** the suite opens sessions with populated logs, missing logs, and actively running output,
**Then** the page shows the correct conversation, waiting, summary, or empty-state view
**And** the tests fail if session log content is blank, stale, or inconsistent with the session status

**Given** known flaky behaviors exist in the current baseline,
**When** Story 7.5 is completed,
**Then** at least the `Plan all stories` / `Develop all stories` reliability gaps and inconsistent session-log visibility are reproduced by failing tests first
**And** those regressions remain covered by the final passing suite

---

## Epic 8: Core Product Operation and Phase Readiness Validation

Users can access bmad-ui as a working visual companion to bmad orchestration workflows, observing flow and analysis context without reading raw logs. Maintainer can validate the self-referential execution loop, establishing the Phase 2 baseline.

**Story to FR mapping:**
- Story 8.1 -> FR28, FR29, FR32
- Story 8.2 -> FR30
- Story 8.3 -> FR31, FR38
- Story 8.4 -> FR39, FR40

### Story 8.1: Deliver Core Workflow Visibility Views

As a user,
I want to view core workflow state and flow context in bmad-ui,
So that I can understand project execution without reading raw orchestration logs.

**Acceptance Criteria:**

**Given** a running workflow context,
**When** the user opens bmad-ui,
**Then** overview screens show current workflow state and key progress signals

**Given** available epic and story data,
**When** navigating core views,
**Then** users can inspect status and progression across backlog items

**Given** missing or stale runtime data,
**When** encountered,
**Then** the UI shows graceful empty and error states instead of crashing

### Story 8.2: Integrate Backlog Artifacts with UI Workflows

As a user,
I want bmad-ui to operate with backlog artifacts produced by bmad workflows,
So that planning outputs and execution views stay connected.

**Acceptance Criteria:**

**Given** planning artifacts exist,
**When** bmad-ui loads related views,
**Then** epics and stories context is surfaced in a consistent, readable format

**Given** artifact updates,
**When** the UI refreshes or receives update signals,
**Then** users can see the latest corresponding state

**Given** malformed artifact inputs,
**When** processed,
**Then** errors are handled with actionable feedback

### Story 8.3: Validate Self-Referential Delivery Loop

As a maintainer,
I want to verify that bmad-ui can support implementation execution from its own generated epics and stories,
So that Phase 1 proves operational readiness for Phase 2.

**Acceptance Criteria:**

**Given** approved epics and stories,
**When** implementation work is executed,
**Then** maintainers can track progress through bmad-ui views

**Given** at least one end-to-end implementation sample,
**When** reviewed,
**Then** planning-to-execution traceability is demonstrable

**Given** loop validation findings,
**When** documented,
**Then** blockers and follow-up actions are captured for Phase 2 planning

### Story 8.4: Establish Phase Boundary and Evolution Guardrails

As a maintainer,
I want explicit boundaries between Phase 1 outcomes and post-MVP expansion,
So that the project can evolve without destabilizing foundational workflows.

**Acceptance Criteria:**

**Given** current scope,
**When** documented,
**Then** Phase 1 done criteria and deferred Phase 2 and 3 items are clearly separated

**Given** proposed enhancements,
**When** triaged,
**Then** maintainers can classify them as foundational hardening versus new capability expansion

**Given** architecture and project-context artifacts,
**When** reviewed,
**Then** they reflect a stable baseline for future refactoring and feature growth

---

## Epic 9: UI Improvements & Polish

Users experience a polished, responsive bmad-ui with improved empty states, loading skeletons, navigation clarity, and accessible status indicators — making the tool feel production-ready and easy to use daily.

**Story to FR mapping:**
- Story 9.1 -> NFR3, NFR21, NFR22
- Story 9.2 -> NFR3, NFR21
- Story 9.3 -> NFR20, NFR21
- Story 9.4 -> NFR3, NFR22
- Story 9.5 -> FR28, NFR21
- Story 9.6 -> FR28, NFR21
- Story 9.7 -> FR29, FR30, FR32, NFR21

### Story 9.1: Improve Empty States and Loading Feedback

As a user,
I want clear loading skeletons and empty state messages,
So that I never see a blank screen or raw spinner without context.

**Acceptance Criteria:**

**Given** any page loading data,
**When** a fetch is in progress,
**Then** a skeleton or shimmer placeholder is shown that matches the final layout

**Given** a page with no data,
**When** loaded,
**Then** a friendly empty state message with a relevant icon and suggested action is displayed

**Given** a fetch error,
**When** encountered,
**Then** an error state with a retry action replaces the blank content area

### Story 9.2: Navigation & Active Route Clarity

As a user,
I want the active navigation item to be clearly highlighted,
So that I always know which section of the app I'm in.

**Acceptance Criteria:**

**Given** any top-level route,
**When** the user is on that page,
**Then** the corresponding nav item is visually distinct using `var(--highlight)` or a background accent

**Given** the navigation bar,
**When** viewed on a narrow viewport,
**Then** nav items remain accessible and do not overflow or truncate illegibly

**Given** navigating between routes,
**When** the route changes,
**Then** the active state updates immediately without a stale highlight on the previous item

### Story 9.3: Status Badge Consistency Across Views

As a user,
I want consistent, accessible status badges on all entities (epics, stories, sessions),
So that I can quickly scan status without decoding inconsistent label styles.

**Acceptance Criteria:**

**Given** any status value (done, in-progress, ready, backlog, running, completed),
**When** displayed,
**Then** it uses the canonical `.step-badge` variant with the correct CSS variable color

**Given** all views that show statuses,
**When** reviewed,
**Then** no hardcoded colors or one-off badge styles exist outside the design system

**Given** screen-reader context,
**When** a badge is read aloud,
**Then** the status label text is meaningful (e.g., "Done", "In Progress") not just an icon

### Story 9.4: Responsive Layout and Spacing Refinements

As a user,
I want the layout to feel clean and well-proportioned on common screen sizes,
So that the app is comfortable to use for extended monitoring sessions.

**Acceptance Criteria:**

**Given** the dashboard at 1280px wide,
**When** rendered,
**Then** panels use consistent gap and padding without unintended overflow or crowding

**Given** long text content (epic titles, session notes),
**When** displayed in a panel,
**Then** text truncates gracefully with ellipsis rather than breaking the layout

**Given** the session table and epic list,
**When** viewed,
**Then** rows have consistent row height and readable line spacing aligned with the design system

### Story 9.5: Session Detail Back Navigation

As a user,
I want the Back button in a session detail page to return me to where I came from,
So that my navigation flow feels natural and I don't lose my place.

**Acceptance Criteria:**

**Given** the session detail page,
**When** the user clicks the Back button,
**Then** the browser navigates to the previous page in history

**Given** the session detail page opened with no prior history (e.g., direct URL),
**When** the user clicks the Back button,
**Then** the user is navigated to /sessions as the default fallback

**Status:** Done

### Story 9.6: Sidebar Running Sessions Panel

As a user monitoring active BMAD agent workflows,
I want the sidebar Sessions section to show only currently running sessions,
So that I can instantly see what's happening without scanning through completed sessions.

**Acceptance Criteria:**

**Given** the sidebar Sessions section,
**When** one or more sessions have `status === "running"`,
**Then** only those running sessions are listed in the sidebar submenu, each with a status indicator dot

**Given** the sidebar Sessions section,
**When** no sessions are currently running,
**Then** a subtle "No active sessions" label is shown in the submenu (instead of nothing)

**Given** a running session listed in the sidebar,
**When** the session transitions to `status === "completed"`,
**Then** it is removed from the sidebar list on the next data refetch (within the existing refetch interval)

**Given** the sidebar Sessions link,
**When** clicked,
**Then** it still navigates to the full sessions list page (all sessions, not just running ones)

**Given** the running sessions list in the sidebar,
**When** more than the sidebar display limit are running,
**Then** only up to that limit are shown, ordered by most-recently-started first

**Notes:**
- Filter `sessionsData` by `status === "running"` before slicing with `SESSIONS_SIDEBAR_LIMIT`
- Reuse the existing `.sidebar-session-status` dot with `data-status="running"` for the green pulse indicator
- The "No active sessions" empty label should use `var(--muted)` and match the `.sidebar-sublink` size/padding

### Story 9.7: Add Planning & Solutioning Step Detail Views

As a user reviewing BMAD workflow phases,
I want direct detail views for the PRD, UX Design, and Architecture steps,
So that I can inspect the related artifacts and understand what each workflow skill will ask before I run it.

**Acceptance Criteria:**

**Given** the Planning phase detail page,
**When** the PRD and UX Design rows render,
**Then** each row includes a detail link that opens a dedicated step detail view without removing the existing run, skip, or session actions

**Given** the Solutioning phase detail page,
**When** the Architecture row renders,
**Then** it includes the same detail link pattern and opens a dedicated Architecture detail view

**Given** a step detail view,
**When** the related planning artifact exists,
**Then** the page shows its current status and a readable markdown preview of the corresponding document

**Given** the UX step has been skipped or no UX markdown artifact exists,
**When** the UX detail view is opened,
**Then** the page shows a graceful skipped or not-created state plus the UX skill guidance instead of an error

**Given** a PRD, UX Design, or Architecture detail view,
**When** the page loads,
**Then** it shows a skill overview plus a summary of the question themes and prompts that the related BMAD skill asks, based on the current workflow step files

**Given** local and production modes,
**When** the detail views load,
**Then** they use the existing dual-mode architecture: dev data from the Vite agent server, production data from emitted static JSON, and frontend fetching through `apiUrl()`

---

## Epic 10: Session Analytics & Autonomous Workflow Optimization

Maintainer can observe rich session-level quality metrics (one-shot success, delivery rate, corrections, aborts, complexity indicators) aggregated by skill and model, enabling data-driven selection of optimal model+skill combinations for autonomous agent workflows.

**Story to FR mapping:**
- Story 10.1 -> FR41, FR44, NFR23, NFR24
- Story 10.2 -> FR42, NFR25
- Story 10.3 -> FR42, FR43
- Story 10.4 -> FR43
- Story 10.5 -> FR45

### Story 10.1: Enrich Session Sync Daemon with Outcome & Complexity Metrics

As a maintainer,
I want the sync-sessions daemon to extract rich outcome and complexity metrics from Copilot CLI events.jsonl logs,
So that each session in agent-sessions.json contains the data needed to determine session quality without manual annotation.

**Acceptance Criteria:**

**Given** a Copilot CLI session with events.jsonl containing user.message, tool.execution_start, abort, session.error, session.compaction_start, and subagent events,
**When** the sync daemon processes the session,
**Then** it extracts and persists the following additional fields to agent-sessions.json:
- `human_turns` (number) — count of real user messages, excluding auto-injected `<skill-context>` and `<reminder>` wrapper content
- `agent_turns` (number) — count of `assistant.turn_end` events
- `git_commits` (number) — count of bash tool calls containing `git commit`
- `git_pushes` (number) — count of bash tool calls containing `git push`
- `aborted` (boolean) — whether an `abort` event occurred
- `context_compactions` (number) — count of `session.compaction_start` events
- `subagent_count` (number) — count of `subagent.started` events
- `subagent_tokens` (number) — sum of `totalTokens` from `subagent.completed` events
- `error_count` (number) — count of `session.error` events
- `duration_minutes` (number) — wall-clock time from session start to last event
- `outcome` (string) — one of: `"pushed"` (git push found), `"committed"` (git commit but no push), `"delivered"` (non-committing skill completed normally), `"aborted"` (abort event), `"error"` (session.error found), `"no-output"` (none of the above)

**Given** a session using a non-committing skill (e.g. `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-retrospective`, `bmad-validate-prd`),
**When** the session completes without abort or error and has at least one agent turn,
**Then** the outcome is `"delivered"` — these skills never produce git commits by design; their output IS the review/plan/analysis itself

**Given** the sync daemon running in watch mode,
**When** a session was already synced as `status: "completed"` with all outcome fields populated,
**Then** it is skipped on subsequent polls to avoid re-parsing large files

**Given** the sync daemon started with `--once`,
**When** 130+ historical sessions exist,
**Then** all sessions are processed and the daemon exits within 30 seconds (NFR23)

**Given** the existing `agent-sessions.json` with sessions that have the old schema (no outcome fields),
**When** the sync daemon runs,
**Then** it enriches those sessions with the new fields via upsert without losing existing data

**Notes:**
- The `human_turns` filter must strip `<skill-context>`, `<reminder>`, `<context>`, and `<current_datetime>` XML blocks and only count messages with >10 chars of real human content remaining
- `outcome` derivation order: `"aborted"` > `"error"` > `"pushed"` > `"committed"` > `"delivered"` (non-committing skills only) > `"no-output"` (first matching wins)
- Non-committing skills set: `bmad-code-review`, `bmad-sprint-planning`, `bmad-sprint-status`, `bmad-retrospective`, `bmad-validate-prd`, `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-check-implementation-readiness`, `bmad-checkpoint-preview`
- Extends the existing `parseCLISession()` function in `scripts/sync-sessions.mjs`

### Story 10.2: Analytics API — Session Quality Aggregation Endpoint

As a maintainer,
I want the API to serve pre-aggregated session quality metrics grouped by skill and model,
So that the frontend can render effectiveness charts without client-side data crunching across hundreds of sessions.

**Acceptance Criteria:**

**Given** the API server reads agent-sessions.json,
**When** a GET request hits `/api/analytics`,
**Then** the response includes a new `quality` object with:
- `bySkill` — for each skill: `{ sessions, delivered, oneShot, corrected, aborted, avgDurationMin, avgAgentTurns, avgHumanTurns }`
- `byModel` — for each model: same shape as bySkill
- `bySkillModel` — for each skill×model combo: same shape, plus `oneShotRate` (0–1)
- `overall` — same shape across all sessions

**Given** a session with `outcome` in `["pushed", "committed", "delivered"]` AND `human_turns === 1`,
**When** aggregated,
**Then** it counts as `oneShot`

**Given** a session with `outcome` in `["pushed", "committed", "delivered"]` AND `human_turns > 1`,
**When** aggregated,
**Then** it counts as `corrected`

**Given** a session with `outcome` in `["pushed", "committed", "delivered"]`,
**When** aggregated,
**Then** it counts as `delivered`

**Given** the analytics endpoint is called with 500+ sessions in agent-sessions.json,
**When** the response is generated,
**Then** it completes within 200ms (NFR25)

**Notes:**
- Add the `quality` field to the existing `buildAnalyticsResponse()` function in `scripts/agent-server.ts`
- Add TypeScript types for quality metrics to `src/types.ts`
- `oneShot` definition: `human_turns === 1 && outcome in ["pushed", "committed", "delivered"] && !aborted`

### Story 10.3: Session Quality Dashboard — Effectiveness Charts

As a maintainer,
I want a new analytics sub-page showing session quality charts broken down by skill and model,
So that I can visually identify which workflows succeed autonomously and which require human intervention.

**Acceptance Criteria:**

**Given** the analytics quality data is available,
**When** the user navigates to `/analytics/quality`,
**Then** the page shows:
1. A summary stat row: total sessions, overall delivery rate (%), overall one-shot rate (%), overall abort rate (%)
2. A horizontal bar chart: one-shot rate per skill (sorted descending)
3. A horizontal bar chart: one-shot rate per model (sorted descending)
4. A stacked bar chart: sessions per skill broken into one-shot / corrected / aborted / no-output segments

**Given** the charts,
**When** rendered,
**Then** they use the existing design system: `var(--status-done)` for one-shot, `var(--status-progress)` for corrected, `var(--highlight-2)` for aborted, `var(--status-backlog)` for no-output

**Given** the analytics layout navigation,
**When** the quality page exists,
**Then** a "Quality" link appears in the analytics sub-navigation between "Models" and the last item

**Given** no sessions have outcome data yet,
**When** the quality page loads,
**Then** a friendly empty state with guidance message is shown: "Run sync-sessions to populate session quality metrics"

**Notes:**
- New route file: `src/routes/analytics-quality.tsx`
- Register in `src/routes/route-tree.ts` under the analyticsLayout children
- Use ECharts (already a dependency) for all charts
- Add chart builders to `analytics-utils.tsx`

### Story 10.4: Skill × Model Effectiveness Matrix

As a maintainer,
I want a heatmap matrix showing one-shot success rate for every skill×model combination that has been used,
So that I can identify the best model for each skill and make data-driven decisions for autonomous workflows.

**Acceptance Criteria:**

**Given** the quality analytics data with `bySkillModel` entries,
**When** the effectiveness matrix is rendered,
**Then** it shows a grid where rows are skills, columns are models, and each cell is color-coded by one-shot rate (green=high, red=low, gray=no data)

**Given** a cell in the matrix,
**When** hovered,
**Then** a tooltip shows: skill name, model name, total sessions, one-shot count, one-shot rate, avg duration, avg human turns

**Given** a skill×model combo with fewer than 3 sessions,
**When** displayed in the matrix,
**Then** the cell has a "low confidence" visual indicator (e.g., dashed border or reduced opacity) to signal insufficient sample size

**Given** the matrix data,
**When** a "Best Model" column exists at the end,
**Then** it highlights the model with the highest one-shot rate for each skill (minimum 3 sessions), or "Insufficient data" if no model has ≥3 sessions

**Notes:**
- Render on the same `/analytics/quality` page below the bar charts, or as a dedicated section
- Use ECharts heatmap or a custom HTML table with CSS variable backgrounds
- Color scale: `var(--status-done)` at 100% → `var(--highlight-2)` at 0% with `var(--status-backlog)` for no data

### Story 10.5: Autonomous Workflow Configuration Generator

As a maintainer,
I want to generate a recommended model-per-skill configuration file based on historical session effectiveness data,
So that I can configure an autonomous workflow runner to use the best-performing model for each skill without manual guesswork.

**Acceptance Criteria:**

**Given** the quality analytics data with sufficient session history (≥3 sessions per skill×model combo),
**When** the user clicks "Generate Config" on the quality dashboard,
**Then** the system produces a YAML or JSON configuration with:
- For each skill: recommended model (highest one-shot rate with ≥3 sessions), fallback model (second highest), confidence level (number of sessions backing the recommendation)
- A `metadata` section with: generation timestamp, total sessions analyzed, data coverage (% of skills with confident recommendations)

**Given** a skill with no model having ≥3 sessions,
**When** the config is generated,
**Then** that skill is listed with `model: "default"` and `confidence: "insufficient-data"`

**Given** the generated configuration,
**When** displayed in the UI,
**Then** it is shown in a copyable code block with syntax highlighting, plus a "Download" button that saves as `autonomous-workflow-config.yaml`

**Given** the effectiveness data changes over time as more sessions are recorded,
**When** the user regenerates the config,
**Then** the recommendations update based on the latest data

**Notes:**
- This is a read-only generation feature — it does not modify any workflow runner
- The config format should be simple enough for a future orchestrator to consume:
  ```yaml
  skills:
    bmad-create-story:
      model: claude-sonnet-4.6
      fallback: claude-haiku-4.5
      one_shot_rate: 0.87
      sessions: 15
    bmad-dev-story:
      model: claude-opus-4.6
      fallback: claude-sonnet-4.6
      one_shot_rate: 0.72
      sessions: 10
  ```
- The `/api/analytics/quality-config` endpoint generates the YAML server-side
- UI renders it via the `marked` library (already a dependency) in a code block

---

## Epic 11: Agent Server Modularization

Maintainers and AI agents can work on the API/backend adapter layer as a set of focused, domain-collocated modules — each domain in its own folder with collocated types, constants, Zod schemas, and functions — instead of a single 4,883-line monolith, enabling faster iteration, safer concurrent modifications, and proper separation of concerns mandated by the architecture.

**Architecture requirements covered:** AR1, AR2, AR3, AR6, AR7
**FRs reinforced:** FR38, FR39
**NFRs reinforced:** NFR13, NFR19

**Decomposition Principles:**
- Domain-driven: each module represents a business domain, not a technical layer
- Full collocation: types, constants, and functions live together in the domain that owns them
- Folder per domain: each domain gets its own folder for multi-file growth
- Zod schemas for validating JSON file reads and request bodies (replacing `as Type` assertions)
- No generic `types.ts`, `constants.ts`, `config.ts`, or `utils.ts` files

**Target Structure:**

```
scripts/server/
├── paths.ts                      — projectRoot + artifactsRoot derivation (~5 lines)
├── runtime/
│   ├── index.ts                  — re-exports
│   ├── state.ts                  — RuntimeState + Zod schema + persistence + creation
│   └── sessions.ts               — RuntimeSession + lifecycle + process mgmt + zombie detection
├── sprint/
│   ├── index.ts                  — re-exports
│   ├── overview.ts               — SprintOverview type + buildOverviewPayload
│   └── summarize.ts              — workflow types + summarization functions
├── epics/
│   ├── index.ts                  — re-exports
│   ├── parser.ts                 — ParsedEpicMarkdownRow + markdown parsing + story content
│   └── dependencies.ts           — DependencyTreeNode + EpicConsistency + dep tree + story deps
├── logs/
│   ├── index.ts                  — re-exports
│   ├── events.ts                 — event finding + log building + describeToolCall
│   └── session-detail.ts         — SessionDetailResponse + detail building + summary extraction
├── analytics/
│   ├── index.ts                  — re-exports
│   ├── store.ts                  — AnalyticsStore + AgentSession + Zod schema + persistence
│   ├── costing.ts                — TokenUsageData + costing models + token parsing
│   └── aggregation.ts            — dedup + validation + buildAnalyticsPayload
├── links-notes/
│   ├── index.ts                  — re-exports
│   ├── links.ts                  — link types + CRUD + YAML serialization
│   └── notes.ts                  — note types + CRUD
└── routes/
    ├── index.ts                  — attachApi coordinator (~50 lines)
    ├── overview.ts
    ├── sessions.ts
    ├── orchestrator.ts
    ├── stories.ts
    ├── epics.ts
    ├── analytics.ts
    ├── workflow.ts
    ├── links.ts
    └── notes.ts
```

**Story to requirement mapping:**
- Story 11.1 -> AR1, AR2, FR38 (establish domain boundary structure + add Zod)
- Story 11.2 -> AR1, AR3 (isolate sprint domain)
- Story 11.3 -> AR1, AR3 (isolate epic domain)
- Story 11.4 -> AR1, AR3 (isolate logs domain)
- Story 11.5 -> AR1, AR3 (isolate analytics domain)
- Story 11.6 -> AR1, AR3, AR6, AR7 (decompose routes + extract links-notes domain)

### Story 11.1: Extract Runtime Domain

As a maintainer,
I want the runtime state management and session lifecycle domain extracted into `scripts/server/runtime/` with collocated types, constants, and Zod schemas,
So that the orchestrator runtime contract — how sessions are created, started, monitored, and cleaned up — lives in one focused domain folder.

**Acceptance Criteria:**

**Given** agent-server.ts,
**When** the runtime domain is extracted,
**Then** a `scripts/server/runtime/` folder is created with:
- `state.ts` containing `RuntimeState` type, Zod schema for runtime-state.json reads (replacing `as RuntimeState` assertions), and functions: `persistRuntimeState`, `readRuntimeStateFile`, `createEmptyRuntimeState`, `loadOrCreateRuntimeState`, `createRuntimeSession`
- `sessions.ts` containing `RuntimeSession` type and functions: `startRuntimeSession`, `isChildProcessAlive`, `resetRunningProcessState`, `ensureRunningProcessStateIsFresh`, `markZombieSessionsAsFailed`, `markZombieAnalyticsSessionsFailed`, `buildAutoResolveInstructions`, `buildAgentCommand`, plus `runningSessionProcesses` state
- `index.ts` re-exporting the public API of both files

**Given** Zod is not yet a project dependency,
**When** this story begins,
**Then** Zod is added via `pnpm add zod`

**Given** a `scripts/server/paths.ts` does not yet exist,
**When** this story is implemented,
**Then** a minimal `scripts/server/paths.ts` is created exporting only `projectRoot` and `artifactsRoot` (derived from `__dirname`), used by all domain modules that need base path resolution

**Given** the extraction is complete,
**When** `pnpm check` is run,
**Then** lint, types, tests, and build all pass with zero regressions

**Given** existing consumers of agent-server.ts (`vite.config.ts`, `vite-plugin-static-data.ts`),
**When** they import from agent-server.ts,
**Then** all imports continue to work without changes — agent-server.ts re-exports from domain modules

### Story 11.2: Extract Sprint & Overview Domain

As a maintainer,
I want sprint summarization and overview construction extracted into `scripts/server/sprint/` with collocated types,
So that the complex sprint aggregation logic — how workflow progress is computed and presented — is navigable independently from runtime, analytics, and routing concerns.

**Acceptance Criteria:**

**Given** the runtime domain from Story 11.1,
**When** the sprint domain is extracted,
**Then** a `scripts/server/sprint/` folder is created with:
- `overview.ts` containing `SprintOverview` type and `buildOverviewPayload` function
- `summarize.ts` containing `StoryStatus`, `EpicStatus`, `WorkflowStepState`, `StoryWorkflowStepSkill`, `EpicWorkflowStepSkill`, `EpicLifecycleSteps` types, `STORY_WORKFLOW_STEPS` and `EPIC_WORKFLOW_STEPS` constants, `sprintStatusFile` path, sprint regex constants, and functions: `summarizeSprintFromEpics`, `loadSprintOverview`, `summarizeSprint`, `summarizeEpicSteps`, `deriveStoryStepStateFromStatus`, `toStepState`
- `index.ts` re-exporting the public API

**Given** the extraction is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

**Given** the original agent-server.ts behavior,
**When** compared before and after,
**Then** all behavior is identical — this is a pure refactoring with no functional changes

### Story 11.3: Extract Epic & Story Domain

As a maintainer,
I want epic markdown parsing, story dependencies, and story content extraction into `scripts/server/epics/` with collocated types,
So that the planning artifact interpretation logic is isolated and testable independently.

**Acceptance Criteria:**

**Given** the sprint domain from Story 11.2,
**When** the epic domain is extracted,
**Then** a `scripts/server/epics/` folder is created with:
- `parser.ts` containing `ParsedEpicMarkdownRow` type, all `EPICS_*` regex constants, `epicsFile` path, and functions: `parseEpicMarkdownRows`, `getEpicMetadataFromMarkdown`, `getStoryContentFromEpics`, `findStoryMarkdown`, `slugifyStoryLabel`
- `dependencies.ts` containing `DependencyTreeNode`, `EpicConsistency` types, `storyDependenciesFile` path, `STORY_ID_PREFIX_REGEX`, `EPIC_DEPENDENCY_NUMBER_REGEX`, `YAML_STORY_HEADER_REGEX`, `YAML_DEP_ITEM_REGEX` constants, and functions: `buildDependencyTree`, `loadStoryDependencies`, `summarizeEpicConsistency`, `updateSprintStoryStatus`
- `index.ts` re-exporting the public API

**Given** the extraction is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

### Story 11.4: Extract Logs & Observability Domain

As a maintainer,
I want log event processing and session detail construction extracted into `scripts/server/logs/` with collocated types,
So that the Copilot CLI log interpretation logic — the core of the observability layer — is navigable and evolvable independently.

**Acceptance Criteria:**

**Given** the runtime domain from Story 11.1,
**When** the logs domain is extracted,
**Then** a `scripts/server/logs/` folder is created with:
- `events.ts` containing event log processing: `findAllCliEventsJsonl`, `buildLogFromEvents`, `describeToolCall`, `stripAnsi`, `escapeRegExp`, and associated regex constants (`PS_LINE_REGEX`)
- `session-detail.ts` containing `ExternalProcess`, `SessionDetailResponse` types, `SUMMARY_LINE_REGEX`, and functions: `buildCleanLogContent`, `buildSessionDetailPayload`, `getExternalCliProcesses`, `getCompletedSessionSummary`, `extractGeneratedSummary`, `extractLastAssistantBlock`, `fallbackSummary`, `readOptionalTextFile`
- `index.ts` re-exporting the public API

**Given** the extraction is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

### Story 11.5: Extract Analytics Domain

As a maintainer,
I want all analytics computation, token usage parsing, costing models, and session deduplication extracted into `scripts/server/analytics/` with collocated types and Zod schemas,
So that the analytics engine — the data processing pipeline for session metrics — can evolve independently.

**Acceptance Criteria:**

**Given** the runtime and logs domains from prior stories,
**When** the analytics domain is extracted,
**Then** a `scripts/server/analytics/` folder is created with:
- `store.ts` containing `AgentSession`, `AnalyticsStore` types, Zod schemas for agent-sessions.json entry validation (replacing `as` assertions), `analyticsStorePath`, and functions: `readAnalyticsStore`, `persistAnalyticsStore`, `upsertAnalyticsSession`, `backfillAnalyticsStore`, `persistSessionAnalytics`
- `costing.ts` containing `TokenUsageData`, `SessionAnalyticsData`, `AnalyticsRatesUsdData`, `AnalyticsEstimatedCostUsdData`, `AnalyticsCostingData` types, costing constants (`DEFAULT_STAGE_MODELS`, `DEFAULT_WORKFLOW_MODEL`, `SKILL_MODEL_OVERRIDES`), and functions: `zeroUsage`, `addUsage`, `normalizeAnalyticsCosting`, `parseTokenUsageFromLog`, `parseTokenCount`, `toNullableNumber`
- `aggregation.ts` containing dedup/validation constants (`SESSION_DEDUP_WINDOW_MS`, `STALE_SESSION_THRESHOLD_MS`), `ANALYTICS_*` regex patterns, and functions: `deduplicateSessions`, `validateRunningStatus`, `buildAnalyticsPayload`, `getEpicIdFromStoryId`, `inferSkillFromLogFilename`, `inferStoryIdFromLogFilename`, `parseRuntimeStateRobust`, `analyticsToRuntimeSession`, `sessionToAnalyticsUpdate`
- `index.ts` re-exporting the public API

**Given** the extraction is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

### Story 11.6: Decompose API Routes by Domain with Zod Validation

As a maintainer,
I want the monolithic `attachApi` function decomposed into domain-grouped route handler modules with Zod request body validation, and the links-notes domain extracted,
So that adding or debugging any API endpoint no longer requires navigating a 1,500-line conditional chain, and request payloads are validated at the boundary.

**Acceptance Criteria:**

**Given** the domain modules from Stories 11.1–11.5,
**When** the links-notes domain is extracted,
**Then** a `scripts/server/links-notes/` folder is created with:
- `links.ts` containing link types, `linksFile` path, `serializeLinksYaml`, `parseSimpleYamlList`, `stripYamlQuotes`, and YAML constants (`YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX`)
- `notes.ts` containing note types, `notesFile` path, and notes CRUD helpers
- `index.ts` re-exporting the public API

**Given** all domain modules exist,
**When** the API routes are decomposed,
**Then** a `scripts/server/routes/` folder is created with:
- `overview.ts` handling `/api/overview` and `/api/events/overview` (imports from sprint)
- `sessions.ts` handling `/api/session/:id`, `/api/events/session/:id`, `/api/session/:id/input`, `/api/session/:id/start`, `/api/session/:id/abort` (imports from runtime + logs)
- `orchestrator.ts` handling `/api/orchestrator/run`, `/api/orchestrator/input`, `/api/orchestrator/run-stage`, `/api/orchestrator/stop` (imports from runtime)
- `stories.ts` handling `/api/story/:id`, `/api/story-preview/:id`, `/api/story/:id/mark-review` (imports from epics)
- `epics.ts` handling `/api/epic/:id` (imports from epics)
- `analytics.ts` handling `/api/analytics`, `/api/sessions/regenerate-logs` (imports from analytics)
- `workflow.ts` handling `/api/workflow/skip-step`, `/api/workflow/unskip-step`, `/api/workflow/run-skill`, `/api/artifacts/files` (imports from runtime + epics)
- `links.ts` handling `/api/links` GET/POST/PUT/DELETE (imports from links-notes)
- `notes.ts` handling `/api/notes` GET/POST/PUT/DELETE (imports from links-notes)
- `index.ts` containing the `attachApi` coordinator (~50 lines) that parses the URL and delegates to domain route handlers

**Given** route handlers that parse request bodies,
**When** JSON bodies are received,
**Then** Zod schemas validate request payloads at the route boundary, replacing `parseJsonBody<T>` type assertions with `z.parse()` calls

**Given** the final `agent-server.ts`,
**When** reviewed,
**Then** it contains only imports from `server/*` modules and the public export block — under 100 lines

**Given** the decomposition is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

## Epic 12: Project Structure Simplification & npm Package Fix

Users and contributors can work with a cleaner `_bmad-ui/` directory layout where the app lives at the top level (no nested `bmad-ui/bmad-ui`), data files are organized under `artifacts/`, and `npx bmad-method-ui install` correctly downloads and installs the app into any bmad project.

**FRs reinforced:** FR22, FR26, FR27, FR38
**NFRs reinforced:** NFR16, NFR19

**Motivation:**
- The current `_bmad-ui/` nesting creates confusion — the outer directory is named after a bmad convention while the inner directory duplicates the project name
- Data files (links, notes, story-dependencies) are scattered at the `_bmad-ui/` root alongside unrelated agent runtime files
- The `npx bmad-method-ui install` command fails to download files in fresh projects, blocking new user adoption
- Simplifying to `_bmad-ui/` with the app at the root level removes one layer of nesting from every file path

**Target Structure:**

```
_bmad-ui/                    ← renamed from _bmad-ui, app files at top level
├── src/                     ← React app source (was _bmad-ui/src/)
├── scripts/                 ← server + build scripts
├── package.json             ← app package.json
├── vite.config.ts
├── tsconfig.json
├── biome.json
├── index.html
├── agents/                  ← runtime data (unchanged)
│   ├── agent-sessions.json
│   ├── runtime-state.json
│   └── logs/
├── artifacts/               ← NEW: consolidated data files
│   ├── links.yaml
│   ├── notes.json
│   └── story-dependencies.yaml
└── ...
```

### Story 12.1: Rename `_bmad-ui` to `_bmad-ui` and Flatten App Directory

As a contributor,
I want the project to use `_bmad-ui/` as the single app directory with source files at the top level,
So that I don't navigate through redundant `_bmad-ui/` nesting for every file.

**Acceptance Criteria:**

**Given** the current `_bmad-ui/` directory exists,
**When** the directory is renamed and flattened,
**Then** `_bmad-ui/` contains all files that were in `_bmad-ui/` (src/, scripts/, package.json, vite.config.ts, tsconfig.json, biome.json, index.html, tests/, playwright.config.ts, vercel.json, .gitignore, .npmrc, .nvmrc, README.md)
**And** `_bmad-ui/agents/` contains the runtime files that were in `_bmad-ui/agents/`
**And** the old `_bmad-ui/` directory no longer exists

**Given** files across the repository reference `_bmad-ui` or `_bmad-ui`,
**When** the rename is applied,
**Then** ALL references are updated in:
- GitHub Actions workflows (`.github/workflows/*.yml`)
- Terraform configs (`infra/vercel/src/*.json`)
- Documentation (`docs/*.md`, `README.md`, `.github/*.md`)
- Copilot instructions (`.github/copilot-instructions.md`)
- VS Code settings (`.vscode/settings.json`)
- Server code (`scripts/server/paths.ts`, `scripts/server/epics/dependencies.ts`, `scripts/vite-plugin-static-data.ts`, `scripts/sync-sessions.mjs`)
- Planning and implementation artifacts (`_bmad-output/**/*.md`)
- Root `package.json` (the `files` field)
**And** no file contains the string `_bmad-ui` after the migration

**Given** the rename and flatten is complete,
**When** `pnpm check` is run from `_bmad-ui/`,
**Then** lint, types, tests, and build all pass with zero regressions

**Given** git history,
**When** the rename is performed,
**Then** `git mv` is used where possible to preserve file history

### Story 12.2: Consolidate Data Files into `_bmad-ui/artifacts/` and Clean Up

As a maintainer,
I want links, notes, and story-dependency data files organized in a dedicated `artifacts/` subdirectory,
So that runtime agent data (sessions, state, logs) is clearly separated from project planning artifacts.

**Acceptance Criteria:**

**Given** `_bmad-ui/` exists from Story 12.1 with `links.yaml`, `notes.json`, `notes.yaml`, and `story-dependencies.yaml` at the top level,
**When** the data files are reorganized,
**Then** `_bmad-ui/artifacts/` is created containing:
- `links.yaml` (moved from `_bmad-ui/links.yaml`)
- `notes.json` (moved from `_bmad-ui/notes.json`)
- `story-dependencies.yaml` (moved from `_bmad-ui/story-dependencies.yaml`)
**And** `notes.yaml` is deleted (superseded by `notes.json`)
**And** no data files remain at the `_bmad-ui/` root level

**Given** server code references file paths for links, notes, and story-dependencies,
**When** the files are moved to `artifacts/`,
**Then** all path references are updated in:
- `scripts/server/links-notes/links.ts` (or wherever `linksFile` is defined)
- `scripts/server/links-notes/notes.ts` (or wherever `notesFile` is defined)
- `scripts/server/epics/dependencies.ts` (or wherever `storyDependenciesFile` is defined)
- Any other server modules that read these files

**Given** the consolidation is complete,
**When** `pnpm check` is run,
**Then** all quality gates pass with zero regressions

**Given** the UI reads links, notes, and story dependencies via API endpoints,
**When** the app is started with `pnpm dev`,
**Then** all data loads correctly from the new `artifacts/` paths

### Story 12.3: Fix `npx bmad-method-ui install` CLI and Publish New Version

As a new bmad user,
I want `npx bmad-method-ui install` to correctly download and install bmad-ui into my project,
So that I can add the UI dashboard to any bmad project with a single command.

**Acceptance Criteria:**

**Given** the root `package.json` defines the npm package,
**When** the package layout is updated,
**Then** the `files` field references `_bmad-ui/` (not `_bmad-ui/`)
**And** `bin/install.mjs` is still included

**Given** `bin/install.mjs` copies files from the package to the user's project,
**When** the installer is updated,
**Then** the source path resolves to `_bmad-ui/` inside the npm package
**And** the destination path creates `_bmad-ui/` in the user's project root (not `_bmad-ui/`)
**And** the `EXCLUDED_SEGMENTS` filter still excludes `node_modules`, `dist`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
**And** the `agents/` directory is excluded from the install (runtime data is project-specific)
**And** the `artifacts/` directory is included with empty/default data files

**Given** the installer is updated,
**When** the overwrite prompt is shown for existing installs,
**Then** the message references `_bmad-ui/` (not `_bmad-ui`)
**And** the success message and next-steps instructions reference the correct paths:
- `cd _bmad-ui`
- `pnpm install`
- `pnpm run dev`

**Given** the package is ready,
**When** tested locally via `npm pack` + `npx`,
**Then** running `npx bmad-method-ui install` in an empty directory creates `_bmad-ui/` with all expected files
**And** no empty directories or missing files

**Given** all tests pass,
**When** a new version is published,
**Then** the version is bumped (at least `0.2.0`) in root `package.json`
**And** `npm publish` succeeds
**And** `npx bmad-method-ui@latest install` works in a fresh directory
