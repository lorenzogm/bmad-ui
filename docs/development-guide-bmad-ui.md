# Development Guide - bmad-ui

> **No secrets required.** You can run, develop, and validate the entire app with zero environment variables. `pnpm dev`, `pnpm run check`, and `pnpm build` all work immediately after `pnpm install`. The `infra/` directory and deploy workflows are maintainer-only — contributors never need them.

## Prerequisites
- Node.js (current LTS recommended)
- npm or pnpm

## Location
- Working directory: _bmad-custom/bmad-ui

## Install
```bash
cd _bmad-custom/bmad-ui
npm install
```

## Run Locally
```bash
npm run dev
```

Per README, dashboard execution in full workspace context may also use:
```bash
pnpm --filter bmad-dashboard dev
```

## Build
```bash
npm run build
```

## Type Check
```bash
npm run check:types
```

## Test
```bash
npm run check:tests
```

## Key Config Files
- _bmad-custom/bmad-ui/vite.config.ts
- _bmad-custom/bmad-ui/tsconfig.json
- _bmad-custom/bmad-ui/package.json

## Typical Workflow
1. Start dev server.
2. Validate route/API interactions in dashboard views.
3. Run type checks and test script before merge.
4. Build to confirm production bundle integrity.
