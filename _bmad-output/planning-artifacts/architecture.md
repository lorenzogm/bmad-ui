---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - /Users/lorenzogm/lorenzogm/bmad-ui/_bmad-output/planning-artifacts/prd.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/_bmad-output/project-context.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/index.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/project-overview.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/integration-architecture.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/data-models-bmad-ui.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/api-contracts-bmad-ui.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/component-inventory-bmad-ui.md
  - /Users/lorenzogm/lorenzogm/bmad-ui/docs/source-tree-analysis.md
workflowType: 'architecture'
project_name: 'bmad-ui'
user_name: 'lorenzogm'
date: '2026-04-15'
lastStep: 8
status: 'complete'
completedAt: '2026-04-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The requirements describe a platform that combines repository governance, infrastructure provisioning, deployment automation, secure configuration handling, and a working product surface for BMAD workflow visibility. Architecturally, they fall into eight groups:

- Open-source governance and repository management
- Infrastructure provisioning for GitHub and Vercel
- Secret and environment lifecycle management
- CI/CD execution and quality enforcement
- Developer experience and workspace standards
- Core product operation as a visual companion to BMAD
- Onboarding and troubleshooting support
- Phase-to-phase extensibility and maintainability

This means the architecture must support both operational infrastructure and product runtime concerns. It is not sufficient to design only the frontend or only the infrastructure pipeline; both are in scope and mutually dependent.

**Non-Functional Requirements:**

The strongest architectural drivers are:

- Reliability requirements around deterministic CI, deployment, and infrastructure workflows
- Security requirements around secret handling, branch protection, least-privilege credentials, and auditability
- Integration requirements around typed API contracts, orchestrator file ingestion, and reproducible pnpm-based workflows
- Performance requirements for onboarding speed, CI completion, and usable dashboard response times
- Accessibility and documentation clarity requirements that affect both UI behavior and project structure

These NFRs indicate that architecture decisions must prioritize operational determinism, explicit boundaries, and recoverability.

**Scale & Complexity:**

This is a medium-complexity brownfield platform with moderate component count but high integration sensitivity.

- Primary domain: full-stack developer tooling platform
- Complexity level: medium
- Estimated architectural components: 8

The architecture is shaped less by algorithmic complexity and more by multi-part coordination across UI, API, orchestrator runtime, infrastructure automation, and documentation.

### Technical Constraints & Dependencies

Known constraints and dependencies include:

- Existing brownfield repository structure with two major parts: dashboard UI and orchestrator runtime
- React, TypeScript, Vite, and TanStack Router on the frontend
- Node.js orchestration runtime producing runtime-state and analytics artifacts
- REST and SSE contracts consumed by the dashboard
- No database-backed domain model in the current system; durable state is file-driven
- VS Code-first contributor workflow
- pnpm as the canonical package manager and command runner
- Terraform-driven GitHub and Vercel provisioning expected by the PRD
- Strong project-context rules that constrain implementation choices for future agents

### Cross-Cutting Concerns Identified

The following concerns affect multiple components and will need explicit architectural treatment:

- Contract stability between orchestrator outputs, API normalization, and frontend types
- Secret and environment management across local, CI, and deployment contexts
- Quality-gate enforcement across repository governance and delivery automation
- Observability and diagnostics for runtime state, session state, and pipeline failures
- Error tolerance for missing, stale, or corrupt runtime artifacts
- Maintainable separation between current Phase 1 infrastructure work and later Phase 2 or Phase 3 product expansion
- Onboarding clarity so the architecture remains operable by contributors, not just understandable by maintainers

## Starter Template Evaluation

### Primary Technology Domain

Web application frontend, embedded in a broader full-stack developer tooling platform, based on project requirements analysis.

### Starter Options Considered

**Vite React TypeScript starter**
- Officially maintained and current
- Matches the existing project's build model and client-first architecture
- Keeps routing, data loading, and application structure under explicit project control
- Works cleanly in monorepos and aligns with the existing package scripts and Vite configuration style

**TanStack Router CLI (`@tanstack/cli create --router-only`)**
- Current and maintained
- Strong option for greenfield projects using TanStack Router
- Can scaffold code-based routing, TypeScript, Tailwind, and toolchain choices
- Less suitable here because the repo already has explicit router and tooling conventions that should not be replaced by scaffold defaults

**Next.js (`create-next-app`)**
- Current and maintained
- Excellent full-stack framework starter
- Introduces App Router, framework-level server conventions, and different architectural defaults
- Misaligned with this repo's existing Vite plus explicit-router structure

**TanStack Start**
- Current but still positioned as RC
- Adds SSR, streaming, server functions, and broader framework semantics
- Too opinionated and heavier than needed for the existing frontend foundation

### Selected Starter: Vite React TypeScript

**Rationale for Selection:**
Vite is the best fit because it reinforces the architecture that already exists instead of forcing a migration. The current frontend package already uses Vite, React, TypeScript, Tailwind via the Vite plugin, and TanStack Router as an application-level routing choice. Selecting Vite as the starter baseline preserves those boundaries cleanly:

- Vite provides the runtime and build foundation
- TanStack Router remains an explicit app dependency, not a scaffolded framework constraint
- Biome, Vitest, pnpm, and the project's path-alias rules remain under repository control
- The resulting architecture stays compatible with the existing orchestrator-plus-API-plus-dashboard split

**Initialization Command:**

```bash
pnpm create vite@latest bmad-ui --template react-ts
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript-enabled React application
- ESM-friendly frontend baseline
- Client-rendered application structure by default

**Styling Solution:**
- No forced styling framework
- Leaves Tailwind v4 integration under project control, which matches the current repo preference

**Build Tooling:**
- Vite development server with HMR
- Vite production build pipeline
- Simple script model compatible with the current package setup

**Testing Framework:**
- No heavy testing opinion baked into the starter
- Allows Vitest to remain the explicit project choice, which matches current practice

**Code Organization:**
- Minimal frontend structure
- Keeps route organization, shared types, and project-specific conventions under direct repository control

**Development Experience:**
- Fast local dev loop
- Monorepo-friendly behavior
- Compatible with the current VS Code-first workflow
- Low-friction base for layering TanStack Router, Tailwind, Biome, and project rules

**Note:** For this brownfield project, the first implementation story should not re-scaffold the package in place. Instead, it should reconcile the existing frontend package against this starter baseline and then add or preserve the project-specific architecture choices on top.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Treat the system as a three-boundary architecture: dashboard frontend, API/backend adapter layer, and orchestrator runtime
- Keep durable runtime state file-based for Phase 1 rather than introducing a database
- Standardize frontend server-state handling on TanStack Query v5
- Preserve REST for snapshot reads and command mutations, with SSE for live updates
- Keep authentication out of the Phase 1 runtime architecture, but design deployment and repository controls as the primary security boundary
- Standardize infrastructure provisioning on Terraform 1.14.x and deployment on Vercel with GitHub-driven CI/CD

**Important Decisions (Shape Architecture):**
- Use shared TypeScript contract models as the source of truth for frontend-consumed payloads
- Put validation and normalization responsibility in the API/backend adapter layer, not in route components
- Use query-key-driven caching in the frontend, with explicit invalidation after mutations
- Keep the frontend component model route-centric, with reusable typed utilities extracted only when repetition appears
- Use GitHub Actions as the authoritative CI gate before protected branch merges

**Deferred Decisions (Post-MVP):**
- End-user authentication and authorization
- Database adoption for runtime/session persistence
- Multi-user tenancy
- GraphQL or alternate API protocol adoption
- Offline-first synchronization
- Distributed background job architecture beyond the current orchestrator process

### Data Architecture

Phase 1 should remain file-backed rather than database-backed.

**Decision:**
- Source of durable runtime truth remains orchestrator-generated JSON and log artifacts
- The API/backend adapter layer reads, validates, normalizes, and serves those artifacts to the dashboard
- Frontend state is treated as server state and managed with TanStack Query v5 plus route-local UI state

**Rationale:**
- This matches the current brownfield design and avoids inventing an unnecessary persistence tier during infrastructure setup
- It keeps Phase 1 focused on reliability and operational readiness instead of data-platform expansion
- It aligns with the documented project scan, which found typed contracts but no schema-owning data service

**Validation strategy:**
- Validate file payloads at the backend adapter boundary before exposing them to the frontend
- Treat missing, partial, or corrupt files as first-class operational error cases
- Keep TypeScript contracts centralized and versionable

**Caching strategy:**
- Use TanStack Query v5 in the frontend for request deduping, staleness control, and mutation invalidation
- Treat SSE as a freshness signal that triggers targeted query invalidation or cache updates
- Do not introduce a separate cache store in Phase 1

### Authentication & Security

Phase 1 security is operational, not user-identity-centric.

**Decision:**
- No end-user authentication layer is required for the Phase 1 product runtime
- Security boundaries are repository governance, deployment controls, secrets handling, and least-privilege infrastructure credentials
- Sensitive orchestration actions remain protected by environment and deployment access, not app-level accounts

**Rationale:**
- The PRD and current API contract evidence do not show a user-account model
- Introducing auth now would expand scope beyond the stated Phase 1 goal
- The real security requirements in this phase are secret hygiene, protected delivery, and auditable operational workflows

**Security controls:**
- dotenvx-based encrypted environment workflow
- Protected branches and required status checks
- Least-privilege GitHub and Vercel credentials
- Auditability through CI history, Terraform state discipline, and repository activity

### API & Communication Patterns

**Decision:**
- Use REST for snapshot reads and command-style mutations
- Use SSE for live overview and session updates
- Keep the orchestrator isolated behind an adapter/API layer instead of letting the frontend consume filesystem artifacts directly

**Rationale:**
- This matches the documented integration architecture and current frontend contract patterns
- REST plus SSE is already sufficient for the dashboard's operational model
- It avoids premature migration to GraphQL, RPC, or framework-coupled data transport

**Error handling standard:**
- Normalize backend adapter errors into typed, UI-safe responses
- Distinguish between transport errors, runtime file integrity errors, and orchestration command failures
- Preserve idempotent handling where already implied, such as tolerated conflict responses

**Rate limiting strategy:**
- Minimal application-layer rate limiting in Phase 1
- Rely primarily on deployment and infrastructure controls unless abuse patterns appear
- Revisit if public-facing command surfaces expand

### Frontend Architecture

**Decision:**
- Use route-centric frontend organization with manual TanStack Router registration
- Adopt TanStack Query v5 for all server-state fetching and mutations
- Keep client-only rendering for the current dashboard package baseline
- Use local component state only for ephemeral UI concerns, not for shared server state

**Rationale:**
- This follows the project-context rules exactly
- It removes the need for `useEffect`-driven fetch orchestration
- It keeps routing, server-state, and presentational logic separated cleanly enough for future AI-agent implementation consistency

**Component architecture:**
- Route files own page composition
- Shared domain types remain centralized
- Reusable fetch/query helpers and transformation utilities live outside route modules when reused
- Avoid introducing a heavyweight component library during Phase 1

**Performance approach:**
- Query-based caching and invalidation
- Route-level code organization that preserves future code splitting options
- SSE-driven freshness instead of aggressive polling where live updates already exist

### Infrastructure & Deployment

**Decision:**
- Use Terraform 1.14.x as the declarative infrastructure baseline
- Use Vercel as the frontend hosting and deployment platform
- Use GitHub Actions as the CI enforcement layer
- Keep environment separation across local, preview, and production

**Rationale:**
- This matches the PRD's operational goals directly
- Vercel is still strongly aligned with Git-connected previews and production web deployments
- Terraform remains the right source-of-truth mechanism for reproducible infra and governance setup

**Monitoring and logging:**
- Treat orchestrator runtime logs and generated state artifacts as operational telemetry inputs
- Add deployment and CI observability through GitHub Actions and Vercel's native tooling
- Defer full observability stack expansion until Phase 2 unless current gaps block supportability

**Scaling strategy:**
- Scale frontend delivery through Vercel-managed hosting
- Scale operational reliability through contract hardening and deterministic pipelines before changing runtime topology
- Do not design for distributed orchestrator execution in Phase 1

### Decision Impact Analysis

**Implementation Sequence:**
1. Stabilize the three-boundary architecture: frontend, adapter/API layer, orchestrator runtime
2. Formalize shared contracts and validation responsibilities
3. Introduce TanStack Query v5 as the standard server-state layer in the frontend
4. Harden REST and SSE integration patterns
5. Standardize Terraform, GitHub Actions, dotenvx, and Vercel workflows
6. Add error-tolerant handling for runtime artifact failure modes
7. Expand observability and hardening only after the baseline path is deterministic

**Cross-Component Dependencies:**
- File-contract stability affects both backend adapter correctness and frontend rendering reliability
- Query strategy affects frontend UX, SSE integration, and mutation consistency
- Terraform and CI decisions affect repository governance, deployment confidence, and contributor workflow
- Secret workflow decisions affect local setup, CI execution, and production deployment safety

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
5 major areas where AI agents could make different choices and create integration drift:
- contract naming and shape drift
- route and file organization drift
- query and mutation implementation drift
- runtime error and loading behavior drift
- orchestration event and logging drift

### Naming Patterns

**Database Naming Conventions:**
No application database is part of Phase 1. If persistence is introduced later, database conventions must be defined in a later architecture revision rather than inferred ad hoc.

**API Naming Conventions:**
- REST resources use lowercase path segments
- Collection and entity endpoints stay noun-based and path-stable
- Existing patterns remain authoritative: `/api/overview`, `/api/epic/{epicId}`, `/api/story/{storyId}`, `/api/session/{sessionId}`
- Route and query identifiers use camelCase inside TypeScript code
- HTTP payload fields returned to the frontend use the contract naming already established in shared TypeScript types
- New endpoints must extend the existing `/api/...` namespace rather than introducing parallel patterns

**Code Naming Conventions:**
- Route files use TanStack Router conventions already established in the repo
- Route constants use explicit named exports ending in `Route`
- React components use PascalCase
- Utility files use descriptive kebab-case or existing local conventions, but route files must follow router naming rules
- Shared types are centralized rather than redefined in route modules
- Constants use full descriptive uppercase or project-consistent descriptive constant naming, never inline magic values

### Structure Patterns

**Project Organization:**
- Route-level page logic stays in the routes area
- Shared reusable logic moves into non-route source files only when reused across routes
- API normalization logic belongs in the backend adapter layer, not in frontend route components
- Orchestrator output generation remains isolated to the runtime/orchestrator side
- Frontend must consume contracts, not raw filesystem assumptions

**File Structure Patterns:**
- Tests are co-located with source files using `*.test.ts` or `*.test.tsx`
- No barrel files
- No ad hoc parallel type definition files when `src/types.ts` already owns the domain shape
- New route files must be manually registered in the route tree
- Static assets and config files should follow existing package-level organization instead of introducing framework-style alternative roots

### Format Patterns

**API Response Formats:**
- Success responses should map cleanly to explicit TypeScript contracts
- Error responses should be normalized at the adapter boundary into a stable structure with machine-readable status plus human-readable message
- Runtime integrity failures, transport failures, and orchestration-command failures must remain distinguishable
- Conflict responses that are intentionally tolerated must be handled consistently rather than special-cased in isolated components

**Data Exchange Formats:**
- TypeScript-facing field names use camelCase
- Date and time values use explicit serialized string forms, preferably ISO 8601, rather than mixed timestamp shapes
- Boolean values remain boolean, never numeric stand-ins
- Missing data should use explicit nullability rules from shared contracts rather than implicit optional drift
- File-derived payloads must be normalized before crossing into frontend code

### Communication Patterns

**Event System Patterns:**
- SSE event handling is treated as a freshness and synchronization channel, not as a separate domain model
- REST snapshot contracts remain the source of truth; live events trigger cache refresh or targeted cache updates
- Event names and payload shapes should be versionable if custom events are added later
- Session and overview streams should remain separated by domain concern, matching current endpoint boundaries

**State Management Patterns:**
- Server state uses TanStack Query
- Local UI state remains local to route or component scope unless a real cross-route need appears
- No global client-state library is introduced unless server-state derivation is insufficient
- Mutations must invalidate or update query caches explicitly
- State transitions should be expressed through named query keys and mutation flows, not side-effect-driven imperative orchestration in components

### Process Patterns

**Error Handling Patterns:**
- Every route that reads remote state must define loading, empty, and error behavior explicitly
- User-facing errors should be concise and operationally useful
- Detailed diagnostics belong in logs or developer-facing debug surfaces, not raw UI copy
- Frontend components should not parse raw backend failure modes repeatedly; adapter normalization should do that once
- Missing or corrupt runtime artifacts must be treated as expected operational cases, not exceptional crashes

**Loading State Patterns:**
- Query-driven loading indicators are the default for remote reads
- Initial page loading and background refresh states must be visually distinct
- SSE connection loss should degrade gracefully to snapshot-based refresh behavior
- Long-running command actions should expose pending state at the action control that initiated them
- Loading state names and booleans should reflect domain meaning, not generic ambiguous names

### Enforcement Guidelines

**All AI Agents MUST:**
- use shared contracts as the source of truth for frontend-consumed data
- register every new route manually in the route tree
- use TanStack Query for server-state fetching and mutation flows instead of `useEffect`
- keep normalization and validation out of route components when it belongs at the adapter boundary
- preserve REST plus SSE boundary rules instead of inventing alternate transport patterns inside isolated features

**Pattern Enforcement:**
- Biome, TypeScript, and Vitest form the automated enforcement baseline
- Architecture and project-context rules are the human and agent enforcement layer
- Pattern violations should be corrected at the abstraction boundary where they originate, not patched repeatedly downstream
- Any pattern change that affects multiple agents must update both the architecture document and project-context guidance

### Pattern Examples

**Good Examples:**
- A new session route defines a named route export, is registered in the route tree, reads data through a query helper, and renders explicit loading, empty, and error states
- A new backend adapter endpoint reads orchestrator JSON, validates it, maps it to shared contract types, and returns a stable JSON shape consumed by the frontend
- A session mutation triggers a command endpoint and explicitly invalidates the affected session and overview queries

**Anti-Patterns:**
- Fetching data directly in a component with `useEffect`
- Parsing raw orchestrator file output inside a route component
- Adding a route file without route-tree registration
- Duplicating domain types inside route modules
- Introducing a second naming convention for similar API resources
- Treating SSE payloads as a separate untyped state system disconnected from the REST contract model

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
bmad-ui/
├── .github/
│   └── skills/
├── _bmad/
│   ├── _config/
│   ├── bmm/
│   └── core/
├── _bmad-custom/
│   ├── bmad-ui/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── README.md
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app.tsx
│   │       ├── styles.css
│   │       ├── types.ts
│   │       └── routes/
│   │           ├── __root.tsx
│   │           ├── index.tsx
│   │           ├── epics.tsx
│   │           ├── epic.$epicId.tsx
│   │           ├── story.$storyId.tsx
│   │           ├── session.$sessionId.tsx
│   │           ├── analytics.tsx
│   │           ├── analytics-dashboard.tsx
│   │           ├── analytics-epics.tsx
│   │           ├── analytics-epic-detail.tsx
│   │           ├── analytics-stories.tsx
│   │           ├── analytics-story-detail.tsx
│   │           ├── analytics-sessions.tsx
│   │           ├── analytics-models.tsx
│   │           ├── analytics-model-detail.tsx
│   │           ├── analytics-utils.tsx
│   │           └── route-tree.ts
│   └── bmad-orchestrator/
│       ├── README.md
│       ├── orchestrator.mjs
│       ├── runtime-state.json
│       ├── analytics.json
│       └── logs/
├── _bmad-output/
│   ├── project-context.md
│   ├── planning-artifacts/
│   │   ├── prd.md
│   │   └── architecture.md
│   └── implementation-artifacts/
├── docs/
│   ├── index.md
│   ├── project-overview.md
│   ├── architecture-bmad-ui.md
│   ├── architecture-bmad-orchestrator.md
│   ├── integration-architecture.md
│   ├── api-contracts-bmad-ui.md
│   ├── data-models-bmad-ui.md
│   ├── component-inventory-bmad-ui.md
│   ├── source-tree-analysis.md
│   ├── development-guide-bmad-ui.md
│   ├── development-guide-bmad-orchestrator.md
│   └── deployment-guide.md
└── _bmad-custom/
```

### Architectural Boundaries

**API Boundaries:**
- The frontend package must only consume normalized API responses and SSE streams
- The adapter/API layer is the boundary between browser-facing contracts and runtime filesystem artifacts
- The orchestrator runtime must never be treated as a direct browser dependency
- Planning artifacts and implementation artifacts are consumed as system inputs, not as frontend-owned state

**Component Boundaries:**
- `_bmad-custom/bmad-ui/src/routes/` owns route-level UI composition and navigation concerns
- `_bmad-custom/bmad-ui/src/types.ts` owns shared frontend-facing domain contracts
- `_bmad-custom/bmad-ui/src/app.tsx` and route modules coordinate UI behavior, but do not own backend normalization rules
- Analytics route modules remain in the route boundary unless a reusable non-route abstraction emerges

**Service Boundaries:**
- `orchestrator.mjs` is the runtime execution boundary
- `runtime-state.json`, `analytics.json`, and `logs/` are runtime outputs, not source modules
- The future adapter/API layer belongs logically between `_bmad-custom/bmad-ui` and `_bmad-custom/bmad-orchestrator`, even if implemented in a separate service or server module later
- Terraform, CI/CD, and deployment concerns belong to repo-level infrastructure boundaries, not package-local UI code

**Data Boundaries:**
- Durable operational data originates from orchestrator-produced files
- Shared contracts define what crosses into the frontend
- Validation and normalization happen before data reaches route components
- No application database boundary exists in Phase 1

### Requirements to Structure Mapping

**Feature and FR Mapping:**
- Core product operation and dashboard visibility:
  - `_bmad-custom/bmad-ui/src/app.tsx`
  - `_bmad-custom/bmad-ui/src/routes/index.tsx`
  - `_bmad-custom/bmad-ui/src/routes/epics.tsx`
  - `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx`
  - `_bmad-custom/bmad-ui/src/routes/story.$storyId.tsx`
  - `_bmad-custom/bmad-ui/src/routes/session.$sessionId.tsx`
- Analytics and workflow analysis:
  - `_bmad-custom/bmad-ui/src/routes/analytics*.tsx`
  - `_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx`
- Runtime orchestration and state production:
  - `_bmad-custom/bmad-orchestrator/orchestrator.mjs`
  - `_bmad-custom/bmad-orchestrator/runtime-state.json`
  - `_bmad-custom/bmad-orchestrator/analytics.json`
  - `_bmad-custom/bmad-orchestrator/logs/`
- Planning and architecture inputs:
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/architecture.md`
  - `_bmad-output/project-context.md`

**Cross-Cutting Concerns:**
- Shared type contracts:
  - `_bmad-custom/bmad-ui/src/types.ts`
- Route registration and navigation consistency:
  - `_bmad-custom/bmad-ui/src/routes/route-tree.ts`
  - `_bmad-custom/bmad-ui/src/routes/__root.tsx`
- UI styling and visual tokens:
  - `_bmad-custom/bmad-ui/src/styles.css`
- Deployment, setup, and operational guidance:
  - `docs/development-guide-bmad-ui.md`
  - `docs/development-guide-bmad-orchestrator.md`
  - `docs/deployment-guide.md`

### Integration Points

**Internal Communication:**
- Orchestrator writes runtime files and logs
- Adapter/API layer reads runtime outputs and exposes normalized REST and SSE interfaces
- Frontend reads snapshots and subscribes to updates through those interfaces
- Mutations from the frontend invoke command endpoints that trigger orchestrator actions

**External Integrations:**
- GitHub for repository governance and CI/CD
- Vercel for preview and production deployment
- dotenvx-managed environment workflow for local and deployed configuration
- Terraform-managed infrastructure lifecycle for GitHub and Vercel resources

**Data Flow:**
1. Planning artifacts define intended work and architecture
2. Orchestrator executes workflow activity and writes runtime outputs
3. Adapter/API layer converts runtime outputs into typed contracts
4. Frontend queries and subscribes to those contracts
5. User actions trigger command-style mutations back through the adapter layer

### File Organization Patterns

**Configuration Files:**
- Package-local build config stays inside `_bmad-custom/bmad-ui/`
- Repo-level planning and BMAD config stay in `_bmad/` and `_bmad-output/`
- Infrastructure and CI config should remain repo-level, not hidden inside frontend source directories

**Source Organization:**
- Frontend source remains package-local in `_bmad-custom/bmad-ui/src/`
- Route modules remain grouped in `routes/`
- Shared frontend contracts remain centralized
- Orchestrator runtime remains isolated in `_bmad-custom/bmad-orchestrator/`

**Test Organization:**
- Tests should be co-located with source files inside the relevant package
- Frontend tests live beside route or shared source modules
- Orchestrator tests, if added, should live beside runtime source rather than under a repo-global generic test folder

**Asset Organization:**
- Frontend static entry and build-facing assets remain package-local
- Runtime-generated logs and analytics remain under the orchestrator package
- Generated planning and implementation artifacts remain under `_bmad-output/`

### Development Workflow Integration

**Development Server Structure:**
- Frontend development runs from `_bmad-custom/bmad-ui/`
- Orchestrator runtime is an adjacent executable subsystem, not bundled into the frontend
- Local development depends on a stable adapter/API contract between the two

**Build Process Structure:**
- Frontend build uses Vite and TypeScript from the frontend package boundary
- Orchestrator runtime remains a separate execution artifact
- Repo-level CI should validate package-local build correctness plus cross-boundary contract integrity

**Deployment Structure:**
- Frontend deploys through Vercel from the frontend package boundary
- Infrastructure automation remains declarative and repo-level
- Runtime/output integration must be explicitly supported rather than assumed by the frontend deployment target

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All major technology and architecture decisions are compatible. The chosen frontend foundation, data-fetching model, contract strategy, and infrastructure tooling reinforce the same operating model: a client-rendered dashboard consuming normalized API contracts backed by orchestrator-generated runtime artifacts.

**Pattern Consistency:**
The implementation patterns support the architectural decisions well. Naming, structure, communication, and process rules all align with the selected stack and reduce likely multi-agent drift.

**Structure Alignment:**
The proposed project structure matches the architecture's intended boundaries. The frontend, orchestrator runtime, generated artifacts, and supporting documentation are separated clearly enough to guide implementation without collapsing concerns.

### Requirements Coverage Validation ✅

**Epic and Feature Coverage:**
No epics were loaded, so validation was performed against functional requirement categories. All major requirement groups have architectural support:
- repository governance and CI/CD
- infrastructure provisioning
- environment and secret handling
- frontend dashboard operation
- runtime visibility and analytics
- onboarding and troubleshooting
- phased extensibility

**Functional Requirements Coverage:**
All 40 functional requirements are covered at the architectural level. Core support exists for publication, deployment, orchestration visibility, developer workflow, operational readiness, and future extension.

**Non-Functional Requirements Coverage:**
All major NFR categories are addressed:
- performance through lightweight frontend delivery and query-driven caching
- security through operational controls, secret hygiene, and protected delivery
- reliability through deterministic infrastructure and explicit runtime error handling
- integration through typed contracts and explicit subsystem boundaries
- scalability through boundary clarity and deferred complexity
- accessibility through preserved UI responsibility and documentation clarity

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical decisions are documented clearly enough to guide implementation. Versions are sufficiently pinned where they materially influence architecture, especially around Vite-era frontend choices, TanStack Query, Terraform 1.14.x, and Vercel.

**Structure Completeness:**
The project structure is concrete and grounded in the current repository layout. Package boundaries, runtime outputs, planning artifacts, and documentation areas are all specified.

**Pattern Completeness:**
The most likely multi-agent conflict points are covered: route registration, server-state handling, contract ownership, loading and error behavior, and transport consistency.

### Gap Analysis Results

**Critical Gaps:**
- None identified that block implementation planning

**Important Gaps:**
- The adapter/API layer is architecturally defined but not yet assigned to a final physical package or directory
- Repo-level CI/CD and infrastructure files are not yet enumerated into exact target paths
- Contract-validation mechanics for orchestrator output normalization are not yet expressed as concrete schema files or validation modules

**Nice-to-Have Gaps:**
- A dedicated contract versioning section could further reduce future drift
- A small example of the adapter/API layer directory structure would improve implementation handoff
- Explicit observability conventions could be expanded in a future revision

### Validation Issues Addressed

No blocking contradictions were found. The remaining open points are implementation-shaping details, not architecture-breaking issues. They should be handled in the first infrastructure and adapter-layer implementation stories.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Strong alignment between current repo reality and target architecture
- Clear boundaries between frontend, adapter layer, and orchestrator runtime
- Good multi-agent consistency rules for routing, contracts, and server-state handling
- Scope discipline that preserves the Phase 1 objective

**Areas for Future Enhancement:**
- Pin the adapter/API layer to a concrete package structure
- Add contract-validation module guidance
- Expand deployment and observability details once implementation starts

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and subsystem boundaries
- Treat shared contracts and route registration rules as mandatory, not optional conventions

**First Implementation Priority:**
Reconcile the existing frontend package to the selected Vite baseline, then implement the adapter/API boundary and TanStack Query-based server-state flow without breaking the current route and contract structure.

---

## Phase 1 Delivered

_Added: 2026-04-21 (Story 7-4) — Extended: 2026-04-21 (Story 8-4)_

Epics 1-7 are complete and Epic 8 is in progress. This section records what was actually
shipped in Phase 1 as a stable baseline for future refactoring and feature growth.

### Delivered Capabilities

| Epic | Capability | Status |
|---|---|---|
| Epic 1 | Open-source repo governance: CODEOWNERS, PR/issue templates, branch protection, MIT license | ✅ Done |
| Epic 2 | Terraform-managed GitHub + Vercel infrastructure; Terraform Cloud state | ✅ Done |
| Epic 3 | dotenvx-based secrets workflow; encrypted `.env.*` files; no plaintext secrets | ✅ Done |
| Epic 4 | CI/CD GitHub Actions workflows: `ci.yml` and `deploy.yml`; merge gate on CI | ✅ Done |
| Epic 5 | Portable CLI: `npx bmad-method-ui install`; published to npm | ✅ Done |
| Epic 6 | Setup, deploy, and troubleshooting documentation in `docs/` | ✅ Done |
| Epic 7 | Playwright E2E smoke tests on all routes as CI merge gate | ✅ Done |
| Epic 8 | Core product operation: workflow visibility and backlog artifact integration delivered; self-referential delivery loop validation pending | 🚧 In progress |

### Architectural Choices Confirmed as Shipped

- **Three-boundary architecture**: frontend (React/Vite/TanStack) / adapter-API (Vite dev middleware + static JSON) / orchestrator runtime — confirmed correct
- **File-backed data, no database**: orchestrator-generated JSON and log artifacts are the source of truth — confirmed
- **No auth layer in Phase 1**: security boundary is deployment access, protected branches, and secrets hygiene — confirmed
- **Dual-mode architecture** (`IS_LOCAL_MODE`): dev mode uses Vite middleware; production serves pre-built static JSON — confirmed
- **TanStack Router with manual route tree**: all routes registered in `src/routes/route-tree.ts` — confirmed
- **TanStack Query v5** for all server state: no `useEffect` for data fetching — confirmed
- **Biome** as sole linter/formatter: no ESLint, no Prettier — confirmed
- **Tailwind CSS v4 via Vite plugin**: no PostCSS, no `tailwind.config.js` — confirmed

### Deferred Decisions — Status at Phase 1 Close

All deferred decisions listed at [Deferred Decisions (Post-MVP)](#data-architecture) remain open and unimplemented:

- End-user authentication and authorization — **not started**
- Database adoption for runtime/session persistence — **not started**
- Multi-user tenancy — **not started**
- GraphQL or alternate API protocol adoption — **not started**
- Offline-first synchronization — **not started**
- Distributed background job architecture — **not started**

Additional deferrals surfaced during Epic 5/6/7/8 work are tracked in `_bmad-output/implementation-artifacts/deferred-work.md`.
