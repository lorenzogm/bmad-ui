---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
classification:
  projectType: infrastructure_platform
  domain: developer_tool
  complexity: medium
  projectContext: brownfield
  coreInitiative: "Establish bmad-ui as a properly infrastructure'd, open-source project by implementing GitHub repository management, Vercel deployment, CI/CD pipelines, secrets management (dotenvx), and a portable installation CLI (npx bmad-method-ui install) — enabling Phase 2 refactoring and Phase 3 feature development."
inputDocuments:
  - /Users/lorenzogm/lorenzogm/lorenzogm/infra/github/README.md
  - /Users/lorenzogm/lorenzogm/lorenzogm/infra/github/src/main.tf
  - /Users/lorenzogm/lorenzogm/lorenzogm/infra/github/src/variables.tf
  - /Users/lorenzogm/lorenzogm/lorenzogm/infra/github/src/providers.tf
  - /Users/lorenzogm/lorenzogm/lorenzogm/infra/vercel/web/src/main.tf
  - _bmad-output/project-context.md
  - docs/project-overview.md
documentCounts:
  productBriefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 2
  infrastructureTemplates: 4
workflowType: 'prd'
lastEdited: '2026-04-19'
editHistory:
  - date: '2026-04-19'
    changes: 'Added E2E testing requirements (FR46-FR52, NFR23-NFR26), updated Product Scope and Risk Mitigation for Playwright testing epic'
---

# Product Requirements Document - bmad-ui Phase 1: Infrastructure Setup

**Author:** lorenzogm
**Date:** 2026-04-15

## Executive Summary

bmad-ui Phase 1 establishes the foundation for publishing bmad-ui as a professional, open-source project that complements the bmad orchestration platform. The goal is to implement GitHub repository management, Vercel deployment, CI/CD pipelines, dotenvx-based secret management, and a portable installation CLI so any bmad project can add bmad-ui with a single command (`npx bmad-method-ui install`).

The target audience is bmad users and developers building AI-assisted products who need a complete workflow orchestration system. bmad-ui is the UI layer for monitoring, controlling, and managing workflows executed by bmad. Publishing bmad-ui with production-grade infrastructure makes the ecosystem accessible and credible.

Phase 1 is the prerequisite for Phase 2 (refactoring and maintainability improvements) and Phase 3 (new guided product development features). This phase prioritizes establishing credibility, accessibility, and technical rigor.

### What Makes This Special

The differentiator is not the individual infrastructure components—those are standard—but the integration of all components into a cohesive, professionally maintained system. bmad-ui's value multiplies when paired with bmad: bmad handles orchestration logic, bmad-ui provides visibility and control. By establishing Phase 1 infrastructure, we communicate that this is a serious, maintained project worthy of adoption and contribution.

The core insight is that individual contributors and small teams can only benefit from the bmad ecosystem when it is accessible and professionally presented. Infrastructure maturity signals reliability and long-term commitment.

## Project Classification

**Project Type:** Infrastructure Platform  
**Domain:** Developer Tooling for AI-assisted product development  
**Complexity:** Medium (minimal configuration of reusable Terraform templates; brownfield extension)  
**Project Context:** Brownfield (establishing open-source infrastructure for existing product)  
**Phase:** 1 of 3 (Infrastructure Setup)

## Success Criteria

### User Success

bmad users and AI developers discover bmad-ui as the UI complement to bmad. The repository is professional, well-organized, and approachable enough that new users can clone, deploy, and run it without friction.

**Measurable:** New users can go from GitHub discovery to running bmad-ui locally in under 15 minutes with provided documentation.

### Business Success

Phase 1 launches bmad-ui publicly on GitHub and acquires initial user traction demonstrating market validation.

**Measurable:** Repository is public, CI/CD pipelines are functional, initial GitHub community feedback/stars indicate adoption interest.

### Technical Success

All infrastructure components are configured, tested, and working end-to-end. The project is maintainable and ready for Phase 2 refactoring.

**Measurable:** 
- GitHub repo fully configured with branch protection, labels, and issue templates
- Vercel deployment working with proper environment management via dotenvx
- CI/CD pipelines passing on all commits
- Portable installation CLI (`npx bmad-method-ui install`) validated end-to-end

### Measurable Outcomes

- Phase 1 completion: 2 hours from PRD completion to ready-to-merge
- First public GitHub repository with all infrastructure operational
- Initial adoption: GitHub community discovery and early adopter validation
- Zero-friction onboarding: Documentation enables 15-minute local setup

## Product Scope

### MVP - Phase 1 (2-hour target)

- GitHub repository infrastructure fully configured
- Vercel deployment pipeline working
- CI/CD GitHub Actions workflows operational
- dotenvx secrets management configured
- Portable installation CLI (`npx bmad-method-ui install`) published and documented
- Basic README and setup documentation
- Publish to GitHub as public repository
- Playwright E2E test infrastructure with smoke tests covering all existing UI routes

### Growth - Phase 2

- Code refactoring for maintainability and technical debt reduction
- Enhanced documentation, examples, and contribution guidelines
- Preparation for new feature development

### Vision - Phase 3+

- Agentic development flow visualization and analysis UI
- Advanced orchestration monitoring and control features
- Guided product development workflow integration (PRD -> epics -> stories)

## User Journeys

### Journey 1: Existing bmad User - Success Path

**Persona:** Alex, an engineer already using bmad in terminal workflows.

**Opening Scene:** Alex likes bmad's power but lacks a visual layer for status, flow, and quick diagnostics. They discover bmad-ui announced as a public companion project.

**Rising Action:**
1. Alex opens the public repo and reads a clear README with architecture, setup, and deployment options.
2. Alex follows dotenvx + local setup instructions and runs the UI in under 15 minutes.
3. Alex connects bmad-ui to their current orchestration context and sees flow and analysis data.
4. Alex validates that CI status, deployment docs, and environment configuration are production-minded.

**Climax:** Alex sees agentic flow visibility that was previously fragmented across logs and scripts.

**Resolution:** Alex adopts bmad-ui as the default control/visibility layer for bmad and recommends it internally.

**Failure/Recovery Path:**
If setup fails due to secrets/env mismatch, Alex uses troubleshooting docs and example env templates to recover quickly.

### Journey 2: AI Developer New to bmad - Evaluation and Adoption

**Persona:** Priya, an AI product developer evaluating orchestration tooling.

**Opening Scene:** Priya is comparing options for agentic development workflows and wants a system that is transparent and maintainable.

**Rising Action:**
1. Priya finds the repo via GitHub search and scans project positioning.
2. Priya reviews quickstart, architecture diagrams, and CI/deploy badges.
3. Priya deploys to Vercel using documented steps and validates pipeline behavior.
4. Priya tests sample workflow visibility and understands how bmad + bmad-ui fit together.

**Climax:** Priya realizes the ecosystem is not just a demo; it is operationally structured and shareable.

**Resolution:** Priya adopts bmad + bmad-ui for initial pilot use and tracks outcomes.

**Failure/Recovery Path:**
If deployment fails, Priya follows explicit Terraform and pipeline troubleshooting steps and resolves without maintainer intervention.

### Journey 3: Maintainer/Admin - Publish and Operate Phase 1

**Persona:** Lorenzo, solo maintainer responsible for launch quality.

**Opening Scene:** Lorenzo needs to publish bmad-ui publicly with credible infrastructure and minimal manual drift.

**Rising Action:**
1. Copies proven infrastructure templates (GitHub + Vercel + pipelines) with minimal adaptation.
2. Configures dotenvx secrets model at repo root and validates non-leakage workflow.
3. Applies Terraform for repository and deployment infrastructure.
4. Verifies branch protections, CI checks, and deployment paths.
5. Publishes repo and confirms onboarding instructions are accurate.

**Climax:** Infrastructure, pipelines, and secrets strategy all work together in a reproducible flow.

**Resolution:** Phase 1 is complete; project is publicly shareable and ready for Phase 2 refactor execution.

**Failure/Recovery Path:**
If pipeline or Terraform drift appears, maintainer uses documented state/import/runbook process to restore deterministic behavior.

### Journey 4: Support/Troubleshooting User - Resolve Onboarding Blockers

**Persona:** Sam, power user helping others adopt the project.

**Opening Scene:** New users report setup friction around env vars, toolchain, or workflow assumptions.

**Rising Action:**
1. Sam uses docs to triage by failure type: secrets, CI, deploy, or local runtime.
2. Sam reproduces issues from a clean environment using quickstart steps.
3. Sam applies fixes from troubleshooting matrix and opens documentation improvements.

**Climax:** Reproducible onboarding path is restored with clear root-cause notes.

**Resolution:** New users recover faster; maintainers receive cleaner issues and fewer repeated questions.

**Failure/Recovery Path:**
If a problem lacks documentation, Sam creates a contribution PR adding steps and diagnostics for future users.

### Journey 5: API/Integration Consumer - CI/CD and Infrastructure Integration

**Persona:** Dana, developer integrating this repo into a broader engineering stack.

**Opening Scene:** Dana needs confidence that this open-source project can be integrated into existing automation and governance.

**Rising Action:**
1. Reviews CI workflow behavior, quality gates, and branching model.
2. Verifies Terraform-based infra approach aligns with internal policy.
3. Confirms environment and secret handling through dotenvx process.
4. Integrates project checks into their own pipeline strategy.

**Climax:** Dana sees that operational standards are explicit and automatable.

**Resolution:** Project is approved for integration in a broader toolchain.

**Failure/Recovery Path:**
If policy constraints appear, Dana maps required controls to documented workflows and adds missing controls via contribution.

### Journey Requirements Summary

These journeys reveal the capabilities Phase 1 must provide:

1. Public project discoverability and credibility:
  - Clear positioning, quickstart, architecture clarity, badges, and release/readiness signals.
2. Fast onboarding:
  - End-to-end setup path that reliably gets users running quickly, with deterministic prerequisites.
3. Reproducible infrastructure operations:
  - Terraform-backed GitHub/Vercel setup, explicit state management, minimal manual steps.
4. Secure secret management:
  - dotenvx-based process, environment separation, and safe contributor workflow.
5. Reliable automation:
  - CI/CD pipelines with quality gates, branch protections, and deployment confidence.
6. Troubleshooting and supportability:
  - Error taxonomy, runbooks, and contribution loops to reduce repeated onboarding failures.
7. Integration readiness:
  - Operational patterns that external teams can adopt, audit, and extend.

## Developer Tool Specific Requirements

### Project-Type Overview

bmad-ui Phase 1 is a developer tooling release focused on operational readiness, not feature breadth. The product must be usable by bmad users and AI developers with a low-friction setup path and a clear execution loop from planning artifacts to implementation work.

Primary technical scope for this phase is TypeScript and Terraform. Tooling and workflows should prioritize reproducibility, fast onboarding, and maintainable operations over broad ecosystem coverage.

### Technical Architecture Considerations

- Language/toolchain baseline:
  - TypeScript for application/runtime code.
  - Terraform for infrastructure provisioning and environment management.
- Package manager standard:
  - pnpm is the supported package manager for install, scripts, and CI execution.
- Editor support:
  - VS Code is the only first-class IDE target in Phase 1.
  - Documentation and workflow assumptions may be VS Code-specific.
- Documentation posture:
  - Minimal, high-signal docs: quickstart, required env setup, deploy trigger path, and troubleshooting essentials.
  - Avoid broad tutorials until post-Phase 1.

### Language and Tooling Matrix

- Supported languages/tools:
  - TypeScript (app and workflow-facing code)
  - Terraform (GitHub/Vercel infrastructure)
- Explicitly out of scope in Phase 1:
  - Multi-language SDKs
  - Alternative IaC stacks
  - Non-pnpm package manager instructions

### Package and Execution Standards

- pnpm is required for:
  - Dependency installation
  - Local dev commands
  - CI pipeline command execution
- Lockfile consistency must be enforced in CI to avoid environment drift.

### IDE Integration Requirements (VS Code Only)

- VS Code workspace should provide a smooth contributor path with:
  - predictable scripts/tasks
  - lint/typecheck/test commands mapped clearly
  - minimal setup instructions tailored to VS Code users

### Documentation and Example Strategy

- Minimal docs for Phase 1 must include:
  - local setup
  - dotenvx secret workflow
  - Terraform apply/import flow for infra
  - CI/CD and deployment expectations
- Example strategy:
  - The primary example is operational: the application must be used to execute development against backlog-created epics and stories.
  - This validates that bmad-ui is not only deployable, but usable as the system of work for building and evolving itself.

### Implementation Considerations

- Phase 1 acceptance should verify:
  - Infra and app can be set up with pnpm + documented env flow.
  - GitHub and Vercel provisioning workflows are reproducible with Terraform.
  - VS Code-centric developer experience is sufficient for solo execution.
  - The app can run a self-referential delivery loop: consume backlog epics/stories and support implementation execution for the app itself.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

MVP Approach: platform-readiness MVP.
The objective is a publishable, reproducible foundation that proves bmad-ui can operate as the execution surface for backlog-driven development.

Resource Requirements: solo maintainer with TypeScript, Terraform, CI/CD, and repo operations familiarity.

### MVP Feature Set (Phase 1)

Core User Journeys Supported:
- Existing bmad user discovers repo, installs, runs, and sees flow/analysis.
- New AI developer evaluates, deploys, and confirms bmad + bmad-ui fit.
- Maintainer publishes and operates with reproducible infra workflows.
- Support user can troubleshoot onboarding issues from docs.
- Integration user can evaluate CI/infra standards for adoption.

Must-Have Capabilities:
- Public GitHub repo with governance baseline.
- Terraform-managed GitHub and Vercel setup (minimal adaptation).
- CI/CD passing with pnpm-based workflows.
- dotenvx-based secret workflow at repo root.
- Minimal but complete setup/deploy/troubleshooting docs.
- VS Code-first developer path.
- Operational validation that app supports execution from backlog epics/stories.
- E2E Playwright tests covering all UI routes for regression detection and safe iteration.

### Post-MVP Features

Phase 2 (Post-MVP):
- Refactoring for maintainability and feature-readiness.
- Documentation expansion and contribution ergonomics.
- Reliability hardening across workflows and runtime diagnostics.

Phase 3 (Expansion):
- Rich agentic flow visualization and analysis features.
- Advanced orchestration controls.
- Guided product workflow UX from context to PRD to epics/stories.

### Risk Mitigation Strategy

Technical Risks:
- Risk: infra drift and CI non-determinism.
- Mitigation: Terraform as source of truth, lockfile enforcement, explicit runbooks.

Market Risks:
- Risk: low initial adoption despite publication.
- Mitigation: fast onboarding path, clear positioning for bmad users and AI developers, immediate feedback loops via issues/discussions.

Resource Risks:
- Risk: solo maintainer overload.
- Mitigation: strict phase boundaries, minimal docs scope in Phase 1, defer non-critical improvements to Phase 2.

Regression Risks:
- Risk: UI changes break existing routes or interactions without detection.
- Mitigation: Playwright E2E smoke tests on all routes run in CI as a merge gate; contributors run the same suite locally before submitting.

## Functional Requirements

### Open-Source Publication and Governance

- FR1: Maintainer can publish bmad-ui as a public repository.
- FR2: Maintainer can define repository governance rules for protected branches and required checks.
- FR3: Maintainer can define project metadata and repository configuration as managed artifacts.
- FR4: Maintainer can define and maintain issue labels for triage workflows.
- FR5: Contributor can understand contribution expectations from repository-level guidance.

### Infrastructure Provisioning and Environment Management

- FR6: Maintainer can provision and manage GitHub repository infrastructure through declarative configuration.
- FR7: Maintainer can provision and manage deployment infrastructure through declarative configuration.
- FR8: Maintainer can apply infrastructure changes across environments with minimal manual steps.
- FR9: Maintainer can import and reconcile existing infrastructure into managed state.
- FR10: Maintainer can separate development and production environment configuration.

### Secrets and Configuration Safety

- FR11: Maintainer can manage project secrets through a consistent encrypted workflow.
- FR12: Contributor can run the project without direct access to production secret values.
- FR13: Maintainer can define root-level secret management conventions for all workflows.
- FR14: Maintainer can rotate and update secret values without redefining application capabilities.
- FR15: Maintainer can validate that sensitive values are excluded from public source artifacts.

### CI/CD and Delivery Automation

- FR16: Maintainer can trigger automated validation workflows on repository changes.
- FR17: Maintainer can enforce quality gates before protected branch integration.
- FR18: Maintainer can run a standard dependency and script workflow using the project's package management standard.
- FR19: Maintainer can trigger deployment workflows tied to approved repository events.
- FR20: Maintainer can observe workflow outcomes and identify failing stages.
- FR21: Contributor can validate contributions against the same automated checks used by maintainers.

### Developer Experience and Tooling Standards

- FR22: Contributor can install and run the project using pnpm as the canonical package manager.
- FR23: Contributor can execute a standard local workflow from VS Code.
- FR24: Contributor can run linting and type validation through documented project commands.
- FR25: Maintainer can define and enforce coding and formatting standards for contributors.
- FR26: User can install bmad-ui into any bmad project using `npx bmad-method-ui install`.
- FR27: Contributor can discover required setup steps from minimal quickstart documentation.

### Core Product Operation for Phase 1

- FR28: User can access bmad-ui as a visual companion to bmad orchestration workflows.
- FR29: User can observe workflow flow and analysis context relevant to agentic development.
- FR30: User can use bmad-ui in conjunction with backlog artifacts created in bmad workflows.
- FR31: Maintainer can validate that bmad-ui supports development execution against epics and stories generated in backlog workflows.
- FR32: User can interpret current project/workflow state through the UI without reading raw orchestration logs.

### Onboarding, Troubleshooting, and Adoption

- FR33: New user can complete local setup from repository documentation.
- FR34: New user can complete deployment setup from repository documentation.
- FR35: Support user can diagnose common setup and pipeline failures using documented troubleshooting guidance.
- FR36: Contributor can submit documentation improvements when onboarding gaps are identified.
- FR37: Maintainer can collect and review early adoption signals from public project interaction.

### Extensibility and Phase Readiness

- FR38: Maintainer can use Phase 1 outputs as baseline inputs for Phase 2 refactoring.
- FR39: Maintainer can preserve a clear boundary between Phase 1 delivery and post-MVP feature expansion.
- FR40: Maintainer can evolve the product toward advanced agentic capabilities without replacing foundational workflows.

### Session Analytics and Autonomous Workflow Optimization

- FR41: Maintainer can automatically capture session-level outcome metrics (one-shot success, delivery, abort, correction count) from Copilot CLI and VS Code debug logs without manual annotation.
- FR42: Maintainer can view per-skill and per-model effectiveness metrics to identify which combinations produce the best autonomous output.
- FR43: Maintainer can compare session quality across model+skill combinations to inform autonomous workflow configuration decisions.
- FR44: Maintainer can track session complexity indicators (context compactions, subagent spawns, tool distribution) to diagnose why sessions fail or require corrections.
- FR45: Maintainer can export or generate an autonomous workflow configuration recommending optimal model assignments per skill based on historical session data.

### End-to-End Testing and Regression Safety

- FR46: Maintainer can run Playwright E2E tests that verify all existing UI routes render without JavaScript errors.
- FR47: Maintainer can detect regressions in navigation, page rendering, and core user interactions through automated E2E tests executed on every change.
- FR48: Contributor can run the full E2E test suite locally before submitting changes using a single documented command.
- FR49: CI pipeline includes E2E test execution as a required quality gate before protected branch merge.
- FR50: Maintainer can add new E2E test scenarios incrementally as features are developed without modifying existing test infrastructure.
- FR51: E2E tests validate that data-dependent views (sessions, epics, analytics) render correctly with real project artifact data.
- FR52: Maintainer can identify JavaScript runtime errors and broken user interactions through automated headless browser testing.

## Non-Functional Requirements

### Performance

- NFR1: Local setup validation commands complete in under 10 minutes on a standard developer machine with stable network.
- NFR2: CI validation workflow completes within 15 minutes for standard pull requests.
- NFR3: Core UI pages for flow/analysis views render initial usable state within 3 seconds under normal load.
- NFR4: Documentation lookup for setup/deploy/troubleshooting enables users to find required steps within 2 navigation actions from README entry points.

### Security

- NFR5: Secrets are never committed in plaintext to version control.
- NFR6: Secret values are managed through dotenvx workflow with environment separation for development and production.
- NFR7: Repository branch protection enforces required checks before merge to protected branches.
- NFR8: Deployment credentials and tokens are scoped to least-privilege access needed for workflow execution.
- NFR9: Sensitive infrastructure operations are auditable through repository and workflow history.

### Reliability

- NFR10: Main-branch CI success rate is maintained at or above 95% over rolling 30 runs.
- NFR11: Deployment pipeline provides deterministic outcomes for unchanged inputs.
- NFR12: Infrastructure provisioning workflows include rollback/recovery guidance for failed apply or import operations.
- NFR13: Required quality checks (lint, types, tests/build where applicable) must pass before protected branch integration.

### Integration

- NFR14: GitHub and Vercel infrastructure workflows must execute using documented Terraform procedures without undocumented manual intervention.
- NFR15: Backlog-driven development loop (epics/stories to implementation execution) must be operable through the documented bmad + bmad-ui workflow.
- NFR16: Tooling commands and automation are standardized on pnpm and produce consistent results across local and CI contexts.
- NFR17: VS Code-first developer workflow is fully documented and sufficient for solo execution of setup, validation, and deployment tasks.

### Scalability

- NFR18: CI/CD and repository workflow design supports at least 10 active pull requests per week without process bottlenecks requiring workflow redesign.
- NFR19: Project structure and automation conventions support incremental adoption by additional contributors without changing core Phase 1 operating model.

### Accessibility

- NFR20: Public documentation uses clear structure and readable formatting suitable for broad developer audiences.
- NFR21: Core UI views maintain keyboard-navigable interaction paths for primary workflows.
- NFR22: New UI additions in Phase 1 do not reduce existing accessibility quality baseline of the application.

### Session Analytics Performance

- NFR23: Session sync daemon must process all historical sessions on startup within 30 seconds.
- NFR24: Session quality metrics must be derivable entirely from local log files without network calls or external API dependencies.
- NFR25: Analytics aggregation for model+skill effectiveness must handle at least 500 sessions without noticeable UI lag.

### Testing and Regression Safety

- NFR26: E2E test suite completes within 5 minutes on CI for the full Playwright test matrix.
- NFR27: All existing UI routes must have at least one E2E smoke test covering render-without-error verification.
- NFR28: E2E tests run headless in CI and optionally headed locally using a single command-line flag.
- NFR29: E2E test failures in CI block merge to protected branches with clear failure output identifying the broken route or interaction.
