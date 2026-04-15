# BMAD Dashboard App

Dashboard for observing BMAD orchestration and sprint state.

## What It Shows

- Live orchestration runtime state from `_bmad-custom/bmad-orchestrator/runtime-state.json`
- Active and completed agent sessions
- Story progress summary from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Preview of key BMAD output files

## API Endpoints (dev server only)

- `GET /api/overview` returns sprint summary + runtime + file previews
- `POST /api/orchestrator/run` starts orchestrator (`pnpm bmad:orchestrate -- --execute --non-interactive`)
- `POST /api/orchestrator/stop` stops orchestrator process

## Run

```bash
pnpm --filter bmad-dashboard dev
```

Open the printed local URL in your browser.
