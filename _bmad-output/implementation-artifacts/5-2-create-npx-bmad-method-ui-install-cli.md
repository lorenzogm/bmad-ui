# Story 5.2: Create npx bmad-method-ui Install CLI

Status: ready-for-dev

## Story

As a bmad user,
I want to run `npx bmad-method-ui install` in my bmad project,
so that bmad-ui is added to my project's `_bmad-custom` folder without manual copying or monorepo setup.

## Acceptance Criteria

1. **Given** any directory containing a bmad project, **When** `npx bmad-method-ui install` is run, **Then** the `_bmad-custom/bmad-ui` app is copied into the current directory with all source files intact.

2. **Given** the install completes, **When** the user follows the printed next steps, **Then** they can run `cd _bmad-custom/bmad-ui && pnpm install && pnpm dev` to start the UI.

3. **Given** the npm package is published as `bmad-method-ui`, **When** a user runs `npx bmad-method-ui install`, **Then** it fetches the latest published version without requiring git clone or manual file copying.

4. **Given** an existing `_bmad-custom/bmad-ui` directory, **When** install is run again, **Then** the CLI warns the user before overwriting and requires explicit `--force` flag to proceed.

## Tasks / Subtasks

- [ ] Create the CLI package (AC: #1, #2, #3)
  - [ ] Add `packages/cli/` directory at repo root with its own `package.json`
    - [ ] Set `name: "bmad-method-ui"`, `version: "0.1.0"`, `bin: { "bmad-method-ui": "./index.mjs" }`
    - [ ] Set `files: ["index.mjs", "app/**"]` to include only CLI + bundled app
  - [ ] Write `packages/cli/index.mjs` — the CLI entry point
    - [ ] Parse `install` subcommand (exit with usage if unknown command)
    - [ ] Detect `--force` flag for overwrite protection (AC: #4)
    - [ ] Check for existing `_bmad-custom/bmad-ui` and warn if `--force` not set (AC: #4)
    - [ ] Copy `app/` (bundled `_bmad-custom/bmad-ui` source) into `process.cwd()/_bmad-custom/bmad-ui`
    - [ ] Print clear next-steps after install (AC: #2)
- [ ] Bundle app source into CLI package (AC: #1, #3)
  - [ ] Copy `_bmad-custom/bmad-ui/` into `packages/cli/app/` as part of the publish preparation
  - [ ] Add a `prepare` or `prepack` script in `packages/cli/package.json` that syncs `../../_bmad-custom/bmad-ui` → `./app`
  - [ ] Ensure `.gitignore` excludes `packages/cli/app/` (generated artifact, not checked in)
  - [ ] Ensure `.npmignore` (or `files` field) includes `app/` in the published package
- [ ] Publish configuration (AC: #3)
  - [ ] Confirm `packages/cli/package.json` has correct `main`, `bin`, and `files` fields for npm publish
  - [ ] Add `publishConfig: { access: "public" }` for scoped or first publish
  - [ ] Verify `npx bmad-method-ui install` works locally via `npm pack` + extract test
- [ ] Overwrite protection (AC: #4)
  - [ ] CLI exits with non-zero code and descriptive message if dir exists and `--force` not passed
  - [ ] CLI succeeds silently with `--force` when dir exists
- [ ] Post-install messaging (AC: #2)
  - [ ] Print block with: installed path, `cd` command, `pnpm install`, `pnpm dev`, and note about `.env` setup

## Dev Notes

### Repository Layout After This Story

```
/ (repo root)
├── _bmad-custom/
│   └── bmad-ui/          ← the app (source of truth, unchanged)
└── packages/
    └── cli/
        ├── package.json  ← name: "bmad-method-ui", bin: bmad-method-ui
        ├── index.mjs     ← CLI script (install command)
        └── app/          ← gitignored; copied from _bmad-custom/bmad-ui at pack time
```

### Design Rationale

- **No monorepo tooling required.** The CLI is a standalone package in `packages/cli/`. It does not require Turbo, pnpm workspaces, or root-level package.json.
- **Self-contained installation.** A user running `npx bmad-method-ui install` in their bmad project gets a ready-to-run `_bmad-custom/bmad-ui` app without any knowledge of this repo's structure.
- **Single source of truth.** The app source lives only in `_bmad-custom/bmad-ui`. The `packages/cli/app/` copy is generated at publish time, not tracked in git.

### CLI Behavior (index.mjs)

```
$ npx bmad-method-ui install
✔ bmad-ui installed to ./_bmad-custom/bmad-ui

Next steps:
  cd _bmad-custom/bmad-ui
  pnpm install
  pnpm dev

Then open http://localhost:5173 in your browser.
Note: copy .env.example to .env and configure as needed.
```

```
$ npx bmad-method-ui install   # when _bmad-custom/bmad-ui already exists
✖ _bmad-custom/bmad-ui already exists. Use --force to overwrite.
```

### Prepack Script Example

`packages/cli/package.json` `scripts.prepack`:
```
"prepack": "node -e \"const {cpSync}=require('fs'); cpSync('../../_bmad-custom/bmad-ui', './app', {recursive:true, filter: (s) => !s.includes('node_modules') && !s.includes('dist')})\""
```

### References

- FR26: User can install bmad-ui into any bmad project using `npx bmad-method-ui install` [Source: `_bmad-output/planning-artifacts/prd.md#developer-experience-and-tooling-standards`]
- Epic 5 goal: portable installation, Biome, TypeScript, VS Code conventions [Source: `_bmad-output/planning-artifacts/epics.md#epic-5`]
- App source [Source: `_bmad-custom/bmad-ui/`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
