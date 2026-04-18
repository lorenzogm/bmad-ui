# Story 5.2: Enforce Code Quality Tooling Baseline

Status: ready-for-dev

## Story

As a maintainer,
I want Biome and TypeScript quality standards enforced,
so that contributors follow consistent formatting and typing rules.

## Acceptance Criteria

1. **Given** source files, **When** lint and format checks run, **Then** Biome rules are applied consistently and violations fail with a non-zero exit code.

2. **Given** TypeScript validation, **When** `pnpm check:types` runs, **Then** strictness settings and the `@/*` path alias align with the actual `tsconfig.json` configuration.

3. **Given** a pull request, **When** quality checks run in CI (`ci.yml`), **Then** violations fail the pipeline with actionable diagnostics (per-file annotations visible in the PR review interface).

## Tasks / Subtasks

- [ ] Audit current Biome configuration (AC: #1)
  - [ ] Run `pnpm check:lint` from `_bmad-custom/bmad-ui/` — confirm zero violations on current codebase
  - [ ] Verify `biome.json` rules match project-context.md rules (`useNumberNamespace`, `useImportType`, `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`, `useIsNan`)
  - [ ] Verify `biome.json` formatter settings: `indentStyle: space`, `indentWidth: 2`, `lineWidth: 100`, `trailingCommas: es5`, `semicolons: asNeeded`, `quoteStyle: double`
  - [ ] Confirm `biome check src/` scope is correct — no source files excluded unintentionally
  - [ ] Run `biome check --write=false src/` to confirm formatting is enforced (same as CI path)

- [ ] Audit TypeScript configuration (AC: #2)
  - [ ] Run `pnpm check:types` from `_bmad-custom/bmad-ui/` — confirm zero type errors on current codebase
  - [ ] Verify `tsconfig.json` has `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`
  - [ ] Verify `paths: { "@/*": ["./src/*"] }` matches the vite alias `"@": "/src/"` in `vite.config.ts`
  - [ ] Confirm `tsconfig.json` is standalone (no `extends` to non-existent `@repo/configs/typescript/react.json`)

- [ ] Add GitHub Actions annotations to CI for actionable diagnostics (AC: #3)
  - [ ] Update the Lint step in `.github/workflows/ci.yml` to use `biome ci --reporter=github src/` instead of `biome check src/`
    - `biome ci` is the CI-optimized variant (exits non-zero on any violation, no auto-fix)
    - `--reporter=github` emits `::error file=...` annotations visible inline in the PR diff
  - [ ] Verify the Summary step in `ci.yml` already outputs diagnostics on failure (`if: always()`) — keep it
  - [ ] Run the full check locally to confirm zero violations before CI change: `cd _bmad-custom/bmad-ui && pnpm check`

- [ ] Update `project-context.md` to reflect accurate configuration (AC: #1, #2)
  - [ ] Fix Technology Stack versions to match actual `package.json` (React 19.2.5, TypeScript 6.0.2, Vite 8.0.8, TanStack Router 1.168.22, Tailwind 4.2.2, Vitest 4.1.4, Biome 2.4.12)
  - [ ] Remove incorrect reference: `config extends @repo/configs/typescript/react.json` — the `tsconfig.json` is standalone
  - [ ] Remove stale note: `@tanstack/react-query is not yet in package.json` — it is installed at `5.99.0`
  - [ ] Update monorepo workspace note — project does NOT have a workspace root; `_bmad-custom/bmad-ui` is self-contained

## Dev Notes

### Current State (confirmed before story creation)

All three quality tools are **already installed and configured**. The story goal is to validate consistency, wire up CI annotations, and fix stale documentation.

**Biome (`_bmad-custom/bmad-ui/biome.json`):**
- Version: `@biomejs/biome@2.4.12`
- Lint + format in one pass via `biome check src/`
- Key rules enforced: `useNumberNamespace`, `useImportType`, `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`, `noDangerouslySetInnerHtmlWithChildren`
- Formatter: 2-space indent, 100-char line width, double quotes, no semicolons, ES5 trailing commas

**TypeScript (`_bmad-custom/bmad-ui/tsconfig.json`):**
- Standalone config (no `extends`) — `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- Path alias: `"@/*": ["./src/*"]`
- Vite resolves it via `resolve.alias: { "@": "/src/" }` in `vite.config.ts`

**CI (`ci.yml`):**
- Triggers: `pull_request` (opened, synchronize, reopened) + `push` to main + `workflow_dispatch`
- Steps: install → `pnpm check:lint` → `pnpm check:types` → `pnpm check:tests` → `pnpm build` → summary
- Working directory for all steps: `_bmad-custom/bmad-ui`

### Critical: `biome ci` vs `biome check` in CI

`pnpm check:lint` runs `biome check src/` — works but does NOT emit GitHub annotations.

Replace the Lint step command with:
```yaml
- name: Lint
  run: pnpm exec biome ci --reporter=github src/
  working-directory: _bmad-custom/bmad-ui
```

`biome ci` differences from `biome check`:
- Always exits non-zero on any violation (even warnings)
- Never auto-fixes files
- `--reporter=github` emits `::error file=<path>,line=<n>,col=<n>::<message>` annotations

### Path Alias Consistency

`tsconfig.json` uses wildcard form `"@/*": ["./src/*"]` (TypeScript requires `/*` suffix for path mapping).
`vite.config.ts` uses `"@": "/src/"` (Vite's alias resolves the prefix, then appends the remainder).
These are intentionally different forms but semantically equivalent — do NOT change either.

Import usage in source: `import { Foo } from "@/components/Foo"` — the `@/` prefix is stripped by both tools.

### pnpm check Script

The full quality gate: `cd _bmad-custom/bmad-ui && pnpm check`

This runs sequentially: `check:lint` → `check:types` → `check:tests` → `build`

Always run this before committing. CI runs the same checks individually for better parallel visibility.

### Project Structure Notes

- `_bmad-custom/bmad-ui/` is fully self-contained — no monorepo root `package.json`
- The cancelled story `5-2-configure-monorepo-task-orchestration.md` explored a root-level monorepo with Turbo — this was **cancelled and is NOT the current architecture**
- `_bmad-custom/bmad-ui/pnpm-workspace.yaml` only contains `onlyBuiltDependencies` — not a workspace root

### Files to Touch

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Update Lint step to use `biome ci --reporter=github` |
| `_bmad-output/project-context.md` | Fix version numbers, remove stale notes |

Files that should **NOT** change: `biome.json`, `tsconfig.json`, `vite.config.ts`, `package.json`

### References

- FR24: Run linting and type validation through documented project commands [Source: `_bmad-output/planning-artifacts/epics.md#story-52`]
- FR25: Define and enforce coding and formatting standards [Source: `_bmad-output/planning-artifacts/epics.md#story-52`]
- Biome CI reporter: `biome ci --reporter=github` [Biome docs: https://biomejs.dev/reference/reporters/]
- Architecture note: Biome + TypeScript + Vitest = automated code quality enforcement baseline [Source: `_bmad-output/planning-artifacts/epics.md#architectural-decisions`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
