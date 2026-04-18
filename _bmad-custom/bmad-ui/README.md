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

## Development

```bash
# Install dependencies
cd _bmad-custom/bmad-ui
pnpm install

# Run all quality checks (lint + types + tests + build)
pnpm check

# Individual checks
pnpm check:lint    # Biome linter + formatter
pnpm check:types   # TypeScript type-check only
pnpm check:tests   # Vitest (passes with no tests)
pnpm build         # Production build
```

Run `pnpm check` before every commit. CI enforces the same set of checks.
