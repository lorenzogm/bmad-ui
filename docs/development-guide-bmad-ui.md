# Development Guide - bmad-ui

> **No secrets required.** You can run, develop, and validate the entire app with zero environment variables. `pnpm dev`, `pnpm run check`, and `pnpm build` all work immediately after `pnpm install`. The `infra/` directory and deploy workflows are maintainer-only — contributors never need them.

## VS Code Setup (Recommended)

1. Open the repository root in VS Code
2. When prompted, click **Install All** to install recommended extensions (`.vscode/extensions.json`)
3. Ensure the Biome extension is active — it provides inline lint errors and format-on-save

If not prompted, run: **Extensions: Show Recommended Extensions** from the Command Palette (`Cmd+Shift+P`).

## Prerequisites
- Node.js (current LTS recommended)
- pnpm 10.16+ — install with `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`

## Location
- Working directory: `_bmad-ui`

## Install
```bash
cd _bmad-ui
pnpm install
```

## Dev Loop

### Start Dev Server
```bash
pnpm dev
```

### Validate (lint + types + tests + build)
```bash
pnpm run check
```

Run this before every commit. All checks must pass.

### Individual checks
```bash
pnpm run check:types   # TypeScript type check
pnpm run check:tests   # run tests
pnpm run check:lint    # Biome linting
```

## Build
```bash
pnpm run build
```

## Key Config Files
- `_bmad-ui/vite.config.ts`
- `_bmad-ui/tsconfig.json`
- `_bmad-ui/package.json`
- `.vscode/extensions.json` — recommended extensions
- `.vscode/settings.json` — editor config (Biome formatter, TypeScript SDK)

## Typical Workflow
1. Open repo root in VS Code, install recommended extensions.
2. `cd _bmad-ui && pnpm install`
3. `pnpm dev` — start the dev server (default: http://localhost:5173)
4. Make changes, save files (Biome auto-formats on save).
5. `pnpm run check` — run full validation before committing.
6. Commit and push.

## Troubleshooting

### Biome not formatting on save

- Confirm the `biomejs.biome` extension is installed and active
- Check the status bar at the bottom — it shows the active formatter for the open file
- Run `pnpm run check:lint` in the terminal to see all Biome issues

### TypeScript path aliases not resolving in editor

- Ensure `.vscode/settings.json` contains `"typescript.tsdk": "_bmad-ui/node_modules/typescript/lib"`
- Reload the VS Code TypeScript server: **TypeScript: Restart TS Server** via Command Palette

### `pnpm` command not found

- Install pnpm: `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`
- Required version: pnpm 10.16+

### Dev server port conflict

- Default port is `5173`. If occupied, Vite will try `5174`, `5175`, etc. — check the terminal output for the actual URL.

### CI, secrets, and deployment issues

For CI validation failures, secrets configuration, and deployment pipeline issues, see [docs/troubleshooting.md](troubleshooting.md).
