# Project Overview

## Project
- Name: bmad-ui
- Repository Type: multi-part monorepo
- Primary Language: TypeScript/JavaScript
- Documentation Scan Mode: initial_scan
- Scan Level: exhaustive

## Executive Summary
This repository hosts BMAD orchestration tooling and a dashboard UI used to monitor and operate story workflows. The codebase is split into two primary parts:
- A web dashboard at _bmad-custom/bmad-ui (React + Vite + TanStack Router)
- A Node.js orchestration utility at _bmad-custom/bmad-orchestrator (script-driven workflow runner)

## Parts

### bmad-ui
- Path: _bmad-custom/bmad-ui
- Classification: web
- Stack: React 19, TypeScript, Vite 7, TanStack Router
- Responsibility: Visualize sprint/runtime state and trigger orchestration actions via API endpoints.

### bmad-orchestrator
- Path: _bmad-custom/bmad-orchestrator
- Classification: cli
- Stack: Node.js (ES modules)
- Responsibility: Execute BMAD stage orchestration, write runtime telemetry, and manage session workflows.

## Key Entry Points
- Web app bootstrap: _bmad-custom/bmad-ui/src/main.tsx
- Web routes root: _bmad-custom/bmad-ui/src/routes/__root.tsx
- Orchestrator runtime script: _bmad-custom/bmad-orchestrator/orchestrator.mjs

## Tech Stack Summary
| Category | Technology | Version | Evidence |
|---|---|---|---|
| Frontend runtime | React | 19.2.0 | _bmad-custom/bmad-ui/package.json |
| Router | @tanstack/react-router | 1.168.15 | _bmad-custom/bmad-ui/package.json |
| Build tool | Vite | 7.1.7 | _bmad-custom/bmad-ui/package.json |
| Language tooling | TypeScript | 5.9.2 | _bmad-custom/bmad-ui/package.json |
| Testing | Vitest | 4.0.1 | _bmad-custom/bmad-ui/package.json |
| Orchestration runtime | Node.js script | N/A | _bmad-custom/bmad-orchestrator/orchestrator.mjs |

## Related Documentation
- Architecture: architecture-bmad-ui.md, architecture-bmad-orchestrator.md
- Source tree: source-tree-analysis.md
- API contracts: api-contracts-bmad-ui.md
- Data models: data-models-bmad-ui.md
- Components: component-inventory-bmad-ui.md
- Development: development-guide-bmad-ui.md, development-guide-bmad-orchestrator.md
- Deployment: deployment-guide.md
- Integration: integration-architecture.md
