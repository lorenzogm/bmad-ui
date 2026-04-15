# Architecture - bmad-orchestrator

## Executive Summary
bmad-orchestrator is a Node.js script utility that coordinates BMAD workflow stages, enforces stage order/checkpoints, and writes runtime telemetry/logs used by the dashboard.

## Technology Stack
| Category | Technology | Version | Why it is used |
|---|---|---|---|
| Runtime | Node.js ES modules | N/A | Script execution and process orchestration |
| Process control | child_process APIs | Node built-in | Launch/monitor stage sessions |
| Filesystem/state | fs + fs/promises | Node built-in | Persist runtime state and logs |

## Architecture Pattern
- Pattern: file-backed orchestration engine.
- Main control loop in orchestrator.mjs:
  - Parses story/status inputs
  - Resolves dependency order
  - Launches skill sessions
  - Persists runtime-state and logs
  - Applies HITL checkpoints between key stages

## Data and State
- Runtime state file: _bmad-custom/bmad-orchestrator/runtime-state.json
- Analytics output: _bmad-custom/bmad-orchestrator/analytics.json
- Session prompt/log artifacts: _bmad-custom/bmad-orchestrator/logs/*

## Interfaces
- The script itself does not expose HTTP routes.
- It integrates through filesystem contracts consumed by the dashboard and BMAD outputs.

## Source Tree
See source-tree-analysis.md for annotated placement inside repository.

## Development Workflow
- Execute through orchestration commands described in README examples.
- Main script entrypoint: _bmad-custom/bmad-orchestrator/orchestrator.mjs

## Deployment
- No CI/CD or infrastructure manifests were detected for standalone deployment.
- Intended as repository-local automation runtime.

## Testing Strategy
- No dedicated test files detected for this part in the current scan scope.
