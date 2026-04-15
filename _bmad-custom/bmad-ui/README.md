# BMAD UI

UI for monitoring BMAD multi-agent workflows, sprint progress, and AI agent sessions.

## What It Shows

- Live agent runtime state from `_bmad-custom/agents/`
- Active and completed agent sessions
- Story progress summary from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Preview of key BMAD output files

## API Endpoints (dev server only)

- `GET /api/overview` returns sprint summary + runtime + file previews
- `POST /api/orchestrator/run` starts agent runner
- `POST /api/orchestrator/stop` stops agent runner process

## Run

```bash
cd _bmad-custom/bmad-ui && npm run dev
```

Open the printed local URL in your browser.
