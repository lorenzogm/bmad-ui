# Story 5.2: Configure Monorepo Task Orchestration

Status: cancelled

> **CANCELLED** — This story was cancelled during Epic 5 course correction. The monorepo approach
> (pnpm workspaces + Turbo at repo root) was replaced with a portable installation model:
> `npx bmad-method-ui install`. See replacement story: `5-2-create-npx-bmad-method-ui-install-cli.md`

## Story

As a maintainer,
I want Turbo task orchestration configured for the workspace,
so that lint, typecheck, test, and build pipelines are cacheable and scalable.

## Acceptance Criteria

1. **Given** the monorepo config, **When** task pipelines are inspected, **Then** lint, typecheck, test, and build tasks are defined in `turbo.json` with explicit dependencies.

2. **Given** repeated local runs, **When** unchanged tasks are executed, **Then** Turbo cache behavior is observable (tasks report `cache hit` for unchanged inputs).

3. **Given** CI runs, **When** workspace tasks execute, **Then** orchestration follows the same pipeline model as local runs (CI invokes `turbo run` commands, not raw package-level scripts directly).

## Tasks / Subtasks

- [ ] Create root-level `pnpm-workspace.yaml` (AC: #1, #2, #3)
  - [ ] Add `packages` field declaring `_bmad-custom/bmad-ui` as a workspace package
  - [ ] Move `onlyBuiltDependencies` entries (`@biomejs/biome`, `esbuild`) from `_bmad-custom/bmad-ui/pnpm-workspace.yaml` to this root file
  - [ ] Remove or empty `_bmad-custom/bmad-ui/pnpm-workspace.yaml` (or delete it — pnpm workspace root is now at repo root)
- [ ] Create root-level `package.json` (AC: #1, #2, #3)
  - [ ] Set `name: "bmad-ui-workspace"`, `private: true`, `packageManager: "pnpm@10.19.0"`, `engines: { node: ">=24", pnpm: ">=10" }`
  - [ ] Add `turbo` as a devDependency
  - [ ] Add root-level scripts: `build`, `check:lint`, `check:types`, `check:tests`, `check` — all delegating to `turbo run <task>`
- [ ] Create root-level `turbo.json` (AC: #1, #2)
  - [ ] Define `build` task with `outputs: ["dist/**"]` and `dependsOn: ["check:types"]`
  - [ ] Define `check:lint` task with `outputs: []`, no upward dependsOn
  - [ ] Define `check:types` task with `outputs: []`, no upward dependsOn
  - [ ] Define `check:tests` task with `outputs: []`, `dependsOn: ["check:types"]`
- [ ] Install turbo at workspace root (AC: #2)
  - [ ] Run `pnpm install` from repo root to create/update root `pnpm-lock.yaml` with turbo
  - [ ] Verify `turbo run build` executes and reports cache hit on second run
- [ ] Update `.github/workflows/deploy.yml` to use workspace root (AC: #3)
  - [ ] Change `package_json_file:` in `pnpm/action-setup@v5` to point to root `package.json` (or remove since root package.json now exists)
  - [ ] Change `cache-dependency-path:` to root `pnpm-lock.yaml`
  - [ ] Remove `working-directory: _bmad-custom/bmad-ui` from install and quality-check steps — run from repo root
  - [ ] Replace `pnpm check` with `pnpm run check` (or `turbo run check:lint check:types check:tests build`) in deploy.yml quality check step
- [ ] Verify end-to-end locally (AC: #1, #2)
  - [ ] `pnpm install` from repo root succeeds
  - [ ] `pnpm run check` from repo root runs all tasks through Turbo
  - [ ] Second `pnpm run check` shows cache hits for unchanged tasks

## Dev Notes

### Repository Layout Context

The repo root (`/`) currently has NO `package.json` and NO `pnpm-workspace.yaml`. The only `package.json` is at `_bmad-custom/bmad-ui/package.json`, which is the sole application package. The existing `_bmad-custom/bmad-ui/pnpm-workspace.yaml` only contains:

```yaml
onlyBuiltDependencies:
  - '@biomejs/biome'
  - esbuild
```

This `onlyBuiltDependencies` config must move to the new root `pnpm-workspace.yaml` so pnpm respects it for the workspace.

### Monorepo Root Setup

**New root `pnpm-workspace.yaml`** (at repo root `/`):
```yaml
packages:
  - '_bmad-custom/bmad-ui'

onlyBuiltDependencies:
  - '@biomejs/biome'
  - esbuild
```

**New root `package.json`** (at repo root `/`):
```json
{
  "name": "bmad-ui-workspace",
  "private": true,
  "packageManager": "pnpm@10.19.0",
  "engines": {
    "node": ">=24",
    "pnpm": ">=10"
  },
  "scripts": {
    "build": "turbo run build",
    "check:lint": "turbo run check:lint",
    "check:types": "turbo run check:types",
    "check:tests": "turbo run check:tests",
    "check": "turbo run check:lint check:types check:tests build"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### Turbo Configuration

**New root `turbo.json`** (at repo root `/`):
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["check:types"],
      "outputs": ["dist/**"]
    },
    "check:lint": {
      "outputs": []
    },
    "check:types": {
      "outputs": []
    },
    "check:tests": {
      "dependsOn": ["check:types"],
      "outputs": []
    }
  }
}
```

**Pipeline logic:**
- `build` depends on `check:types` — TypeScript must pass before Vite bundles.
- `check:tests` depends on `check:types` — avoids running tests against broken types.
- `check:lint` has no dependencies — can run in parallel.
- `build` caches `dist/**` — unchanged source produces a cache hit.

**How Turbo task names map to package scripts:**
Turbo runs `turbo run <task>` → looks for `<task>` in each workspace package's `scripts`. The existing app scripts (`check:lint`, `check:types`, `check:tests`, `build`) already match the task names above. **Do not rename the existing scripts** in `_bmad-custom/bmad-ui/package.json`.

### Existing App Package Scripts (do not change)

From `_bmad-custom/bmad-ui/package.json`:
```json
"scripts": {
  "dev": "vite",
  "preview": "vite preview",
  "check": "pnpm run check:lint && pnpm run check:types && pnpm run check:tests && pnpm run build",
  "build": "tsc --noEmit && vite build",
  "check:lint": "biome check src/",
  "check:types": "tsc --noEmit",
  "check:tests": "vitest run --passWithNoTests"
}
```

The app-level `check` script is a sequential AND of all tasks — it does not need to be removed, but the root-level `check` should use Turbo for caching and observability.

### CI Workflow Changes

The deploy workflow at `.github/workflows/deploy.yml` currently uses:
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v5
  with:
    package_json_file: _bmad-custom/bmad-ui/package.json

- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    cache: "pnpm"
    cache-dependency-path: _bmad-custom/bmad-ui/pnpm-lock.yaml

- name: Install dependencies
  run: pnpm install
  working-directory: _bmad-custom/bmad-ui

- name: Run code quality checks
  run: pnpm check
  working-directory: _bmad-custom/bmad-ui
```

After this story, these steps should change to:
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v5
  # no package_json_file needed — pnpm-workspace.yaml at root

- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    cache: "pnpm"
    cache-dependency-path: pnpm-lock.yaml

- name: Install dependencies
  run: pnpm install
  # runs from repo root, no working-directory

- name: Run code quality checks
  run: pnpm run check
  # runs turbo-orchestrated pipeline from repo root
```

**Important:** Remove `working-directory:` overrides from install and quality check steps. After moving the workspace root to repo root, `pnpm install` at root installs ALL workspace packages.

### Turbo Cache Behavior Verification

After a clean `pnpm run check`, run it again immediately. Turbo output should show:
```
Tasks:    4 successful, 4 total
Cached:   4 cached, 4 total
Time:     Xs >>> FULL TURBO
```

The `FULL TURBO` or `cache hit` messages confirm AC #2.

### Dependency on Story 5.1

Story 5.1 (Standardize pnpm Project Commands) is logically prior to this story — it defines the canonical script names. Since 5.1 is in backlog, assume the existing scripts in `_bmad-custom/bmad-ui/package.json` are the canonical commands. **Do not rename or change** existing scripts as part of this story.

### Project Structure After This Story

```
/ (repo root)
├── package.json           ← NEW: workspace root, turbo devDep
├── pnpm-workspace.yaml    ← NEW: declares _bmad-custom/bmad-ui package
├── pnpm-lock.yaml         ← NEW: generated by pnpm install at root
├── turbo.json             ← NEW: task pipeline definitions
├── .github/
│   └── workflows/
│       └── deploy.yml     ← MODIFIED: update pnpm paths and commands
└── _bmad-custom/
    └── bmad-ui/
        ├── package.json   ← UNCHANGED
        └── pnpm-workspace.yaml  ← REMOVE or empty (moved to root)
```

### References

- FR26: Maintainer can define monorepo workflow conventions for build and task orchestration [Source: `_bmad-output/planning-artifacts/prd.md#developer-experience-and-tooling-standards`]
- Epic 5 goal: pnpm + Turbo + Biome + TypeScript + VS Code conventions established and enforced [Source: `_bmad-output/planning-artifacts/epics.md#epic-5`]
- Existing app scripts [Source: `_bmad-custom/bmad-ui/package.json#scripts`]
- Existing CI workflow [Source: `.github/workflows/deploy.yml`]
- Architecture: Biome, Vitest, pnpm remain under repository control [Source: `_bmad-output/planning-artifacts/architecture.md#selected-starter`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
