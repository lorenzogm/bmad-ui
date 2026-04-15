# Source Tree Analysis

## Repository Tree (annotated)

```text
bmad-ui/
├── _bmad/                         # BMAD core/config module assets
├── _bmad-custom/
│   ├── bmad-ui/                   # Part: Web dashboard application
│   │   ├── index.html             # Vite app HTML shell
│   │   ├── package.json           # Frontend scripts/deps
│   │   ├── src/
│   │   │   ├── main.tsx           # Frontend bootstrap + router provider
│   │   │   ├── app.tsx            # Main dashboard screen and orchestration actions
│   │   │   ├── types.ts           # Shared API/domain types for UI
│   │   │   ├── styles.css         # Global styling
│   │   │   └── routes/            # Route modules (epics, stories, sessions, analytics)
│   │   ├── tsconfig.json          # TypeScript config
│   │   └── vite.config.ts         # Vite build/dev server config
│   └── bmad-orchestrator/         # Part: Orchestration utility
│       ├── orchestrator.mjs       # Main executable workflow orchestrator
│       ├── runtime-state.json     # Runtime state snapshot file
│       ├── analytics.json         # Analytics output data
│       ├── logs/                  # Prompt/log artifacts per run
│       └── README.md              # Operational usage and model defaults
├── _bmad-output/                  # Generated planning/implementation artifacts
└── docs/                          # Generated project documentation (this set)
```

## Critical Folders
- _bmad-custom/bmad-ui/src/routes: Route-level UI modules and API consumers.
- _bmad-custom/bmad-ui/src: Entry point, stateful dashboard logic, and shared types.
- _bmad-custom/bmad-orchestrator: CLI/runtime orchestration source and telemetry outputs.
- _bmad-output: Cross-step artifacts read by dashboard and orchestrator.

## Integration Notes
- Dashboard UI consumes orchestrator and sprint data via /api/* endpoints.
- Orchestrator writes runtime files and logs that are surfaced by the dashboard.
- Both parts are coordinated by shared BMAD artifact directories under _bmad-output and _bmad-custom.
