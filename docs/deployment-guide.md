# Deployment Guide

## Current State
No explicit deployment manifests were detected in this repository scope (no Dockerfile, docker-compose, or CI workflow pipeline files found during scan).

## What Exists
- Frontend build output flow via Vite in _bmad-custom/bmad-ui.
- Orchestrator runtime execution as local Node script in _bmad-custom/bmad-orchestrator.

## Suggested Baseline Deployment Strategy
1. Build dashboard:
```bash
cd _bmad-custom/bmad-ui
npm ci
npm run build
```
2. Host static frontend artifact from dist/ on preferred static host.
3. Run orchestrator on controlled runtime host with repository access and git worktree support.
4. Expose/bridge required API endpoints to dashboard.

## Environment and Security Notes
- No explicit environment variable schema was detected.
- Add deployment-time environment documentation once API host/auth strategy is formalized.

## Operational Checklist
- Verify read/write access for _bmad-output and orchestrator logs.
- Ensure process supervision for orchestrator runtime if used in long-running mode.
- Add CI pipeline and release strategy before production rollout.
