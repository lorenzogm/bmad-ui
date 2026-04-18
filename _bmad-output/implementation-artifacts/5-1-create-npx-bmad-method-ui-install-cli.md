# Story 5.1: Create `npx bmad-method-ui install` CLI

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a bmad user,
I want to run `npx bmad-method-ui install` in my bmad project,
so that bmad-ui is added to my project's `_bmad-custom/bmad-ui` folder instantly without manual copying or monorepo setup.

## Acceptance Criteria

1. **Given** any directory containing a bmad project, **When** `npx bmad-method-ui install` is run, **Then** the `_bmad-custom/bmad-ui` app is copied into the current directory with all source files intact and a printed next-steps message is shown.

2. **Given** the install completes, **When** the user follows the printed next steps, **Then** they can run `cd _bmad-custom/bmad-ui && npm install && npm run dev` to start the UI.

3. **Given** the npm package is published, **When** a user runs `npx bmad-method-ui install`, **Then** it fetches the latest version of bmad-ui without requiring git clone or manual file copying.

4. **Given** an existing `_bmad-custom/bmad-ui` directory, **When** install is run again, **Then** the CLI warns the user before overwriting and requires explicit confirmation (prompt: `_bmad-custom/bmad-ui already exists. Overwrite? (y/N)`; default N aborts).

5. **Given** a successful install, **When** the user opens `_bmad-custom/bmad-ui`, **Then** the folder is fully self-contained: no external workspace dependencies, no monorepo tooling required.

## Tasks / Subtasks

- [ ] Create the npm CLI package at repo root (`package.json`, `bin/install.mjs`) (AC: #1, #2, #3)
  - [ ] Create `package.json` at repo root with `name: "bmad-method-ui"`, `version: "0.1.0"`, `bin: { "bmad-method-ui": "bin/install.mjs" }`, `files: ["bin/", "_bmad-custom/bmad-ui/"]`
  - [ ] Create `bin/install.mjs` as an ES Module CLI script with shebang `#!/usr/bin/env node`
  - [ ] Implement `install` subcommand: copy `_bmad-custom/bmad-ui/` to `<cwd>/_bmad-custom/bmad-ui/`
  - [ ] Print next-steps message after successful copy

- [ ] Implement overwrite guard (AC: #4)
  - [ ] Check if `<cwd>/_bmad-custom/bmad-ui` already exists before copying
  - [ ] Prompt user for confirmation using readline (Node.js built-in — no external prompt library)
  - [ ] Default to No on empty input; abort with message if user declines

- [ ] Verify self-containment (AC: #5)
  - [ ] Confirm `_bmad-custom/bmad-ui/package.json` has `"private": true` and no workspace dependencies (`workspace:*` must not appear)
  - [ ] Confirm `_bmad-custom/bmad-ui/` has no `..` imports escaping the folder

- [ ] Configure `files` in root `package.json` to exclude development artifacts (AC: #3, #5)
  - [ ] Exclude: `_bmad/`, `_bmad-output/`, `_bmad-custom/agents/`, `infra/`, `scripts/`, `.github/`, `docs/`
  - [ ] Include only: `bin/`, `_bmad-custom/bmad-ui/`

- [ ] Add `.npmignore` or rely on `files` field to keep the published package lean
  - [ ] Verify with `npm pack --dry-run` that only `bin/` and `_bmad-custom/bmad-ui/` appear

- [ ] Test the CLI locally end-to-end
  - [ ] Run `node bin/install.mjs install` from a temp directory pointing to the repo
  - [ ] Confirm files land in `_bmad-custom/bmad-ui/` of temp dir
  - [ ] Confirm overwrite guard prompts correctly when run a second time

## Dev Notes

### What This Story Is

This story creates the **npm package wrapper** that enables `npx bmad-method-ui install`. The installed app is the **already-existing** `_bmad-custom/bmad-ui/` directory. The CLI's only job is to copy that directory into the user's project.

**No changes to `_bmad-custom/bmad-ui/` source code are required.** This story is about the packaging and install mechanism only.

### Architecture Decision: Root-Level `package.json`

There is currently **no `package.json` at the repository root**. This story introduces one, scoped only to the `bmad-method-ui` npm package purpose. It must NOT interfere with `_bmad-custom/bmad-ui/package.json` (the app). Key rules:

- Root `package.json`: `name: "bmad-method-ui"`, public npm package, `"type": "module"`, no `workspaces` field.
- App `package.json` at `_bmad-custom/bmad-ui/package.json`: unchanged, `"private": true`.
- The root package does NOT become a monorepo manager — it's a thin CLI wrapper only.

### `bin/install.mjs` Implementation Pattern

```js
#!/usr/bin/env node
// bin/install.mjs
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const [,, command] = process.argv;

if (command !== 'install') {
  console.error('Usage: npx bmad-method-ui install');
  process.exit(1);
}

const __pkgDir = new URL('..', import.meta.url).pathname;
const dest = join(process.cwd(), '_bmad-custom', 'bmad-ui');
const src = join(__pkgDir, '_bmad-custom', 'bmad-ui');

if (existsSync(dest)) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question('_bmad-custom/bmad-ui already exists. Overwrite? (y/N) ', (answer) => {
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
    copyAndFinish(src, dest);
  });
} else {
  copyAndFinish(src, dest);
}

function copyAndFinish(src, dest) {
  cpSync(src, dest, { recursive: true });
  console.log(`\n✅  bmad-ui installed at _bmad-custom/bmad-ui\n`);
  console.log('Next steps:');
  console.log('  cd _bmad-custom/bmad-ui');
  console.log('  npm install');
  console.log('  npm run dev\n');
}
```

**Node.js version requirement:** The root `package.json` must specify `"engines": { "node": ">=18" }` — `cpSync` with recursive is available since Node 16.7 and `import.meta.url` in bin scripts requires ESM, stable from Node 12+. Node 18 is a safe minimum for `npx` users.

### Root `package.json` Template

```json
{
  "name": "bmad-method-ui",
  "version": "0.1.0",
  "description": "Install bmad-ui into any bmad project with a single command",
  "type": "module",
  "engines": { "node": ">=18" },
  "bin": { "bmad-method-ui": "bin/install.mjs" },
  "files": ["bin/", "_bmad-custom/bmad-ui/"],
  "keywords": ["bmad", "ui", "installer"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/lorenzogm/bmad-ui.git"
  }
}
```

**No dependencies** — the CLI uses only Node.js built-ins (`fs`, `path`, `readline`).

### Files To Create / Modify

| File | Action |
|---|---|
| `package.json` (repo root) | **CREATE** — new npm CLI package manifest |
| `bin/install.mjs` | **CREATE** — CLI entry point |
| `_bmad-custom/bmad-ui/package.json` | **NO CHANGE** — already `"private": true`, already correct |

### Files NOT To Touch

- `_bmad-custom/bmad-ui/src/**` — no source code changes
- `_bmad-custom/bmad-ui/vite.config.ts` — no changes
- `.github/workflows/` — out of scope
- `infra/` — out of scope

### Self-Containment Verification

Before marking done, verify `_bmad-custom/bmad-ui/package.json` has NO `workspace:*` references:

```bash
grep -r "workspace:" _bmad-custom/bmad-ui/package.json
# Must return empty
```

Verify no `..` path escapes in source:
```bash
grep -r "\.\.\/" _bmad-custom/bmad-ui/src/ || true
# Should return nothing (or only intra-src relative imports, which are fine)
```

### Local Test Workflow

```bash
# From repo root — test the CLI without publishing
mkdir /tmp/test-bmad-install && cd /tmp/test-bmad-install
node /path/to/repo/bin/install.mjs install
ls _bmad-custom/bmad-ui   # should show source files
# Test overwrite guard:
node /path/to/repo/bin/install.mjs install
# Should prompt: "_bmad-custom/bmad-ui already exists. Overwrite? (y/N)"
```

### npm Pack Dry-Run

```bash
# From repo root — verify only intended files are included
npm pack --dry-run
# Expect: bin/install.mjs + all _bmad-custom/bmad-ui/** files
# Must NOT include: _bmad/, _bmad-output/, infra/, scripts/, .github/, docs/
```

### Project Structure Notes

- New files: `package.json` (root), `bin/install.mjs`
- The `bin/` directory is new at repo root — it is NOT the same as `_bmad-custom/bmad-ui/src/`
- `_bmad-custom/bmad-ui/` remains the source of truth for the installed app
- No changes to `_bmad-custom/bmad-ui/` directory structure are needed

### References

- FR22: Contributor can install and run the project using pnpm [Source: prd.md#Functional-Requirements]
- FR26: User can install bmad-ui into any bmad project using `npx bmad-method-ui install` [Source: prd.md#Functional-Requirements]
- FR27: Contributor can discover required setup steps from quickstart docs [Source: prd.md#Functional-Requirements]
- Epic 5 goal: "Any bmad user can add bmad-ui to an existing bmad project with a single command" [Source: epics.md#Epic-5]
- Architecture: project structure shows `_bmad-custom/bmad-ui/` as the self-contained app package [Source: architecture.md#Complete-Project-Directory-Structure]
- Self-containment requirement: "no external workspace dependencies, no monorepo tooling required" [Source: epics.md#Story-5.1]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
