# Story 5.2: Enforce Code Quality Tooling Baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want Biome and TypeScript quality standards enforced,
so that contributors follow consistent formatting and typing rules.

## Acceptance Criteria

1. **Given** source files under `_bmad-custom/bmad-ui/src/`, **When** `pnpm check:lint` runs, **Then** Biome rules are applied consistently and no violations are reported.

2. **Given** TypeScript validation via `pnpm check:types`, **When** typecheck runs, **Then** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, and the `@/*` → `./src/*` path alias are all active — tsc exits 0 with no errors.

3. **Given** a pull request, **When** `bmad-ui-ci` runs in GitHub Actions, **Then** lint, type-check, tests, and build steps run sequentially and any violation fails the job with actionable diagnostic output.

4. **Given** the `pnpm check` script, **When** a contributor runs it locally, **Then** it runs lint → types → tests → build in order and exits non-zero on first failure.

5. **Given** the `README.md` inside `_bmad-custom/bmad-ui/`, **When** a new contributor reads it, **Then** the quality check commands (`pnpm check`, `pnpm check:lint`, `pnpm check:types`) are documented.

## Tasks / Subtasks

- [x] Verify Biome configuration is complete and correct (AC: #1)
  - [x] Run `pnpm check:lint` — confirm zero violations on current codebase
  - [x] Confirm `biome.json` enforces: `useNumberNamespace`, `useIsNan`, `useImportType`, `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`
  - [x] Confirm formatter settings: 2-space indent, 100 line width, double quotes, trailing commas es5

- [x] Verify TypeScript configuration is correct (AC: #2)
  - [x] Run `pnpm check:types` — confirm zero errors
  - [x] Confirm `tsconfig.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`, `paths: { "@/*": ["./src/*"] }`
  - [x] Confirm `include` covers `src`, `vite.config.ts`, `src/vite-env.d.ts`

- [x] Verify CI quality gate is functional (AC: #3)
  - [x] Confirm `.github/workflows/ci.yml` runs lint → type-check → tests → build steps in order for PRs and pushes to main
  - [x] Confirm Summary step uses `if: always()` and emits pass/fail status + branch/commit context
  - [x] No changes required if already correct

- [x] Verify `pnpm check` composite script (AC: #4)
  - [x] Run `pnpm check` locally — confirm all four steps run and the script exits non-zero if any step fails
  - [x] Confirm script order in `package.json`: `check:lint && check:types && check:tests && build`

- [x] Update README with quality commands (AC: #5)
  - [x] Add a "Development" or "Quality Checks" section to `_bmad-custom/bmad-ui/README.md`
  - [x] Document: `pnpm check` (all checks), `pnpm check:lint`, `pnpm check:types`, `pnpm check:tests`, `pnpm build`

## Dev Notes

### Current State — What Already Exists

Most of this story is about **verification and documentation**. The tooling is already configured:

| Tool | Config File | Status |
|---|---|---|
| Biome 2.4.12 | `biome.json` | ✅ Configured |
| TypeScript 6.0.2 | `tsconfig.json` | ✅ Strict mode |
| Vitest 4.1.4 | `package.json` | ✅ `--passWithNoTests` flag |
| pnpm check | `package.json` scripts | ✅ Composite script |
| CI enforcement | `.github/workflows/ci.yml` | ✅ All 4 steps present |

**Do NOT reinvent or reconfigure these.** Your job is to verify they work correctly and document them.

### Biome Configuration Requirements

The `biome.json` MUST enforce these rules (already present — just verify):
- `useNumberNamespace: "error"` — enforces `Number.parseInt`, `Number.isNaN`, etc.
- `useIsNan: "error"` — enforces `Number.isNaN()` over `isNaN()`
- `useImportType: "error"` — enforces `import type { ... }` for type-only imports
- `noBarrelFile: "error"` — prohibits `index.ts` barrel files
- `noUnusedVariables: "error"` — catches dead code
- `noUnusedImports: "error"` — catches unused imports
- Formatter: 2-space indent, 100 line width, double quotes, `es5` trailing commas

If any of these are missing from the current `biome.json`, add them.

### TypeScript Configuration Requirements

The `tsconfig.json` MUST have (already present — just verify):
- `"strict": true` — enables all strict checks
- `"noUnusedLocals": true`
- `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"paths": { "@/*": ["./src/*"] }` — path alias
- `"module": "ESNext"` and `"moduleResolution": "bundler"` — required for Vite
- `"noEmit": true` — tsc is type-check only, Vite handles bundling

Do NOT change `extends` or add a standalone `tsconfig.json` at a different level.

### CI Workflow — `.github/workflows/ci.yml`

The CI runs from repo root but executes from `_bmad-custom/bmad-ui` working directory. Key characteristics:
- Uses `pnpm/action-setup@v5` with `package_json_file: _bmad-custom/bmad-ui/package.json`
- Node 24 (`node-version: "24"`)
- Steps in order: Checkout → Setup pnpm → Setup Node → Install → Lint → Type check → Tests → Build → Summary
- Summary step uses `if: always()` and outputs `${{ job.status }}`
- Triggers: push to `main`, PR to `main`, `workflow_dispatch`

Do NOT modify the CI workflow unless a specific step is missing or broken.

### README Documentation Target

`_bmad-custom/bmad-ui/README.md` needs a new section. Suggested format:

```markdown
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
```

Keep the existing content intact. Only append/add the new section.

### pnpm vs npm

The epic goal mentions "Contributors can install, run, lint, type-check, and build using npm." The `package.json` scripts use `pnpm run ...` internally but the scripts themselves are npm-compatible — `npm run check` will call `npm run check:lint && ...` correctly. No changes needed for npm compatibility; the scripts work with both package managers.

### Files To Modify

| File | Change |
|---|---|
| `_bmad-custom/bmad-ui/README.md` | Add "Development" section with quality commands |
| `_bmad-custom/bmad-ui/biome.json` | Add any missing rules (verify first — likely no change needed) |
| `_bmad-custom/bmad-ui/tsconfig.json` | Verify only — likely no change needed |
| `.github/workflows/ci.yml` | Verify only — likely no change needed |

### Files NOT To Modify

- `_bmad-custom/bmad-ui/src/**` — no source code changes
- `_bmad-custom/bmad-ui/package.json` — scripts already correct
- `_bmad-custom/bmad-ui/vite.config.ts` — no changes
- `infra/`, `scripts/` — out of scope

### Verification Commands

```bash
# Run all checks (must pass before commit)
cd _bmad-custom/bmad-ui && pnpm check

# Individual checks
cd _bmad-custom/bmad-ui && pnpm check:lint
cd _bmad-custom/bmad-ui && pnpm check:types
cd _bmad-custom/bmad-ui && pnpm check:tests
cd _bmad-custom/bmad-ui && pnpm build
```

### Project Structure Notes

- App source: `_bmad-custom/bmad-ui/` — all quality config lives here
- CI workflow: `.github/workflows/ci.yml` — repo-root level
- The two are connected by `working-directory: _bmad-custom/bmad-ui` in the CI job

### References

- FR24: Contributor can run linting and type validation through documented project commands [Source: prd.md#Functional-Requirements]
- FR25: Maintainer can define and enforce coding and formatting standards for contributors [Source: prd.md#Functional-Requirements]
- Epic 5 goal: "Contributors can install, run, lint, type-check, and build using npm with Biome and TypeScript conventions enforced" [Source: epics.md#Epic-5]
- Biome enforcement rules [Source: project-context.md#Code-Quality-Build-Rules]
- TypeScript strict config [Source: project-context.md#TypeScript]
- CI workflow implementation [Source: .github/workflows/ci.yml]
- Architecture: "Biome, TypeScript, and Vitest form the automated enforcement baseline" [Source: architecture.md#Core-Architectural-Decisions]
- `pnpm check` is the single pre-commit quality gate [Source: project-context.md#Build]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Verified `biome.json` has all required rules: `useNumberNamespace`, `useIsNan`, `useImportType`, `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`; formatter at 2-space indent, 100 line width, double quotes, es5 trailing commas. `pnpm check:lint` exits 0 with zero violations.
- Verified `tsconfig.json` has `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`, `paths: { "@/*": ["./src/*"] }`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit: true`, `include: ["src", "vite.config.ts", "src/vite-env.d.ts"]`. `pnpm check:types` exits 0.
- Verified `.github/workflows/ci.yml` runs Lint → Type check → Tests → Build in order, triggers on push/PR to main and workflow_dispatch, Summary step uses `if: always()` with branch/commit context. No changes required.
- Verified `pnpm check` script runs `check:lint && check:types && check:tests && build` in order. `pnpm check` exits 0.
- Added "Development" section to `_bmad-custom/bmad-ui/README.md` documenting `pnpm check`, `pnpm check:lint`, `pnpm check:types`, `pnpm check:tests`, `pnpm build`.

### File List

- `_bmad-custom/bmad-ui/README.md` — added Development section with quality commands

## Change Log

- 2026-04-18: Story 5-2 implemented. All tooling verified (Biome, TypeScript, CI, pnpm check). Added Development section to README with quality commands.
