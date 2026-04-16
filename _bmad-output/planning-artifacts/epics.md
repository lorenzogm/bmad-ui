---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
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
| FR28 | Epic 7 | Access bmad-ui as visual companion to bmad workflows |
| FR29 | Epic 7 | Observe workflow flow and analysis context |
| FR30 | Epic 7 | Use bmad-ui with backlog artifacts from bmad |
| FR31 | Epic 7 | Validate bmad-ui supports execution from epics/stories |
| FR32 | Epic 7 | Interpret project/workflow state through UI |
| FR33 | Epic 6 | Complete local setup from repository documentation |
| FR34 | Epic 6 | Complete deployment setup from documentation |
| FR35 | Epic 6 | Diagnose common setup/pipeline failures from docs |
| FR36 | Epic 6 | Submit documentation improvements |
| FR37 | Epic 6 | Collect and review early adoption signals |
| FR38 | Epic 7 | Use Phase 1 outputs as Phase 2 baseline inputs |
| FR39 | Epic 7 | Preserve clear boundary between Phase 1 and post-MVP |
| FR40 | Epic 7 | Evolve toward advanced agentic capabilities |

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

### Epic 5: Developer Tooling & Portable Installation
Contributors can install, run, lint, type-check, and build the project using pnpm following documented standards. Any bmad user can add bmad-ui to an existing bmad project with a single command (`npx bmad-method-ui install`), with Biome, TypeScript, and VS Code-first conventions established and enforced.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27

### Epic 6: Onboarding, Documentation & Adoption Enablement
New users can complete local setup and deployment from repository documentation in under 15 minutes; support users can diagnose common failures from a troubleshooting guide; contributors can submit improvements; maintainer can observe early adoption signals.
**FRs covered:** FR33, FR34, FR35, FR36, FR37

### Epic 7: Core Product Operation & Phase Readiness Validation
Users can access bmad-ui as a working visual companion to bmad orchestration workflows, observing flow and analysis context without reading raw logs. Maintainer can validate the self-referential execution loop, establishing the Phase 2 baseline.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR38, FR39, FR40

---

## Epic 1: Open-Source Repository Governance & Publication

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

## Epic 5: Developer Tooling and Portable Installation

Contributors can install, run, lint, type-check, and build the project using pnpm following documented standards. Any bmad user can add bmad-ui to an existing bmad project with a single command (`npx bmad-method-ui install`), with Biome, TypeScript, and VS Code-first conventions established and enforced.

**Story to FR mapping:**
- Story 5.1 -> FR22
- Story 5.2 -> FR26
- Story 5.3 -> FR24, FR25
- Story 5.4 -> FR23, FR27

### Story 5.1: Standardize pnpm Project Commands

As a contributor,
I want a canonical set of pnpm commands for install, dev, lint, typecheck, test, and build,
So that local and CI workflows are predictable and aligned.

**Acceptance Criteria:**

**Given** the project scripts,
**When** reviewed,
**Then** install, dev, lint, typecheck, test, and build commands are defined and documented

**Given** a fresh clone,
**When** pnpm install and pnpm validation commands are executed,
**Then** the project runs without undocumented setup steps

**Given** CI execution,
**When** commands run there,
**Then** they use the same pnpm scripts used locally

### Story 5.2: Create npx bmad-method-ui Install CLI

As a bmad user,
I want to run `npx bmad-method-ui install` in my bmad project,
So that bmad-ui is added to my project's `_bmad-custom` folder without manual copying or monorepo setup.

**Acceptance Criteria:**

**Given** any directory containing a bmad project,
**When** `npx bmad-method-ui install` is run,
**Then** the `_bmad-custom/bmad-ui` app is copied into the current directory with all source files intact

**Given** the install completes,
**When** the user follows the printed next steps,
**Then** they can run `cd _bmad-custom/bmad-ui && pnpm install && pnpm dev` to start the UI

**Given** the npm package is published,
**When** a user runs `npx bmad-method-ui install`,
**Then** it fetches the latest version of bmad-ui without requiring git clone or manual file copying

**Given** an existing `_bmad-custom/bmad-ui` directory,
**When** install is run again,
**Then** the CLI warns the user before overwriting

### Story 5.3: Enforce Code Quality Tooling Baseline

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

### Story 5.4: Provide VS Code-First Developer Workflow

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

## Epic 7: Core Product Operation and Phase Readiness Validation

Users can access bmad-ui as a working visual companion to bmad orchestration workflows, observing flow and analysis context without reading raw logs. Maintainer can validate the self-referential execution loop, establishing the Phase 2 baseline.

**Story to FR mapping:**
- Story 7.1 -> FR28, FR29, FR32
- Story 7.2 -> FR30
- Story 7.3 -> FR31, FR38
- Story 7.4 -> FR39, FR40

### Story 7.1: Deliver Core Workflow Visibility Views

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

### Story 7.2: Integrate Backlog Artifacts with UI Workflows

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

### Story 7.3: Validate Self-Referential Delivery Loop

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

### Story 7.4: Establish Phase Boundary and Evolution Guardrails

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
