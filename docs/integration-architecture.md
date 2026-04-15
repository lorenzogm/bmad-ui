# Integration Architecture

## Overview
The repository operates as a two-part system:
- bmad-ui (web dashboard) as the presentation and control plane.
- bmad-orchestrator (Node script) as the execution engine.

## Integration Points

| From | To | Type | Details |
|---|---|---|---|
| bmad-ui | backend API layer (serving orchestrator data) | REST | Reads overview, epic, story, session, analytics payloads via /api/* |
| bmad-ui | backend API layer | SSE | Subscribes to /api/events/overview and /api/events/session/{id} |
| bmad-ui | backend API layer | REST (mutations) | Triggers orchestrator/session actions via POST endpoints |
| bmad-orchestrator | filesystem | File contract | Writes runtime-state.json, analytics.json, logs/*.log, logs/*.prompt.txt |
| API layer | bmad-orchestrator outputs | File ingestion | Serves orchestrator/runtime state to dashboard clients |

## Data Flow
1. Orchestrator updates runtime and analytics files.
2. API layer reads/parses those files and exposes normalized payloads.
3. Dashboard fetches snapshots and subscribes to stream updates.
4. User actions in dashboard invoke control endpoints that call orchestration commands.

## Coupling Risks
- File format coupling between orchestrator output JSON and API parsers.
- Operational dependency on local repository paths and worktree behavior.

## Recommended Hardening
- Version orchestrator output schemas.
- Add API contract tests against sample runtime-state payloads.
- Add fallback behavior for missing/corrupt runtime/log files.
