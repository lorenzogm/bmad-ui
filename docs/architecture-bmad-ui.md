# Architecture - bmad-ui

## Executive Summary
bmad-ui is a single-page React dashboard that presents sprint/orchestration status and invokes backend actions through HTTP and SSE endpoints. It uses file-based route modules and central typed models for consistency across feature pages.

## Technology Stack
| Category | Technology | Version | Why it is used |
|---|---|---|---|
| UI framework | React | 19.2.0 | Component rendering and state management primitives |
| Routing | TanStack Router | 1.168.15 | Typed route tree and route-level modules |
| Build/dev | Vite | 7.1.7 | Fast local dev and bundling |
| Type system | TypeScript | 5.9.2 | Strong typing of API/domain models |
| Testing | Vitest | 4.0.1 | Scripted test runner support |

## Architecture Pattern
- Pattern: route-driven SPA with typed client API consumption.
- Main flow:
  1. Boot router in src/main.tsx.
  2. Load route modules under src/routes.
  3. Route components fetch from /api endpoints and subscribe to SSE where needed.
  4. Shared response contracts are modeled in src/types.ts.

## API Design (client perspective)
- Read models loaded via GET endpoints (overview, story detail, epic detail, session detail, analytics).
- Streaming updates via SSE endpoints under /api/events/*.
- Mutating operations via POST endpoints for orchestrator and session control.

## Data Architecture
- No relational database schema is present in this part.
- Primary data model is TypeScript interface/type contracts in src/types.ts.
- Runtime/session state is consumed from backend-provided payloads.

## Component and Route Overview
- Main dashboard shell/sections in src/app.tsx.
- Feature routes in src/routes:
  - epics.tsx, epic.$epicId.tsx
  - story.$storyId.tsx
  - session.$sessionId.tsx
  - analytics*.tsx modules

## Source Tree
See source-tree-analysis.md for the annotated repository tree.

## Development Workflow
- Start dev server: pnpm --filter bmad-dashboard dev (per README guidance)
- Build: npm run build (from _bmad-ui)
- Type check: npm run check:types
- Tests: npm run check:tests

## Deployment Architecture
- No production deployment manifests were detected in this repository scope.
- Current setup appears focused on local development and orchestration monitoring.

## Testing Strategy
- Test runner configured via Vitest dependency and check:tests script.
- No explicit test files were detected during this scan.
