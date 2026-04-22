# Story 5.3: Provide VS Code-First Developer Workflow

Status: done

## Story

As a contributor,
I want a clear VS Code-oriented setup and workflow guide,
so that I can become productive quickly in the preferred environment.

## Acceptance Criteria

1. **Given** the docs, **When** onboarding from scratch, **Then** required VS Code setup steps and common commands are clearly documented.

2. **Given** the recommended workflow, **When** followed, **Then** contributors can run development and validation loops without extra tooling assumptions.

3. **Given** troubleshooting needs, **When** common setup issues occur, **Then** docs provide quick resolution steps or links to the right section.

## Tasks / Subtasks

- [x] Add `.vscode/extensions.json` with recommended extensions (AC: #1, #2)
  - [x] Include Biome extension (`biomejs.biome`) for integrated lint/format
  - [x] Include GitLens, Tailwind CSS IntelliSense, and other project-relevant extensions
- [x] Update `.vscode/settings.json` with project-specific editor config (AC: #1, #2)
  - [x] Set Biome as default formatter for TS/TSX/JS/JSX/JSON/CSS files
  - [x] Enable format-on-save using Biome
  - [x] Configure TypeScript path aliases to resolve correctly in editor
  - [x] Disable conflicting built-in formatters (Prettier, etc.)
- [x] Update `docs/development-guide-bmad-ui.md` to be VS Code-first (AC: #1, #2, #3)
  - [x] Add VS Code setup section (install recommended extensions)
  - [x] Document the full dev loop: install → dev server → validate → commit
  - [x] Use `pnpm` commands consistently (not `npm`)
  - [x] Add troubleshooting section for common issues
- [x] Verify `.vscode/` changes do not break existing Copilot settings (AC: #2)

## Dev Notes

### Current State

**`.vscode/settings.json` (exists, currently minimal):**
```json
{
  "github.copilot.chat.cli.showExternalSessions": true,
  "github.copilot.chat.cli.sessionController.enabled": true
}
```
These Copilot settings MUST be preserved — do not overwrite, only extend.

**`.vscode/extensions.json` — does NOT exist yet.** Must be created.

**`docs/development-guide-bmad-ui.md` (exists):**
- Uses `npm install` / `npm run ...` commands — these should be updated to `pnpm`
- Missing VS Code extension guidance
- Missing troubleshooting section
- Otherwise well-structured, keep and extend it

**`.github/CONTRIBUTING.md`** already has a solid development workflow section using `pnpm` — align with it, do not duplicate or contradict.

### `.vscode/extensions.json` Content to Create

```json
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "eamodio.gitlens",
    "GitHub.copilot",
    "GitHub.copilot-chat"
  ]
}
```

- `biomejs.biome` — critical: provides inline lint errors and format-on-save for the project's Biome config
- `bradlc.vscode-tailwindcss` — Tailwind v4 class IntelliSense (configured via Vite plugin, no `tailwind.config.js`)
- `eamodio.gitlens` — git blame, history, and diff tools
- `GitHub.copilot` / `GitHub.copilot-chat` — primary development tools for this repo

### `.vscode/settings.json` Additions

Add the following to the existing settings, preserving the current Copilot entries:

```json
{
  "github.copilot.chat.cli.showExternalSessions": true,
  "github.copilot.chat.cli.sessionController.enabled": true,

  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" },
  "[jsonc]": { "editor.defaultFormatter": "biomejs.biome" },
  "[css]": { "editor.defaultFormatter": "biomejs.biome" },

  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "_bmad-ui/node_modules/typescript/lib",

  "tailwindCSS.experimental.configFile": null,
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascriptreact"
  }
}
```

**Key reasons:**
- Biome formatter must be set per-language to override VS Code defaults — without this, VS Code uses the built-in TypeScript formatter and ignores Biome on save.
- `typescript.tsdk` points to the workspace-local TypeScript install (`_bmad-ui/node_modules/typescript/lib`) so the VS Code TS server uses the same version as the build (5.9.x).
- `tailwindCSS.experimental.configFile: null` tells the Tailwind CSS IntelliSense extension not to look for `tailwind.config.js` — this project uses Tailwind v4 via Vite plugin only, no config file exists.

### `docs/development-guide-bmad-ui.md` Required Updates

Replace `npm install` / `npm run ...` with `pnpm` equivalents:

| Current (incorrect) | Correct |
|---|---|
| `npm install` | `pnpm install` |
| `npm run dev` | `pnpm dev` |
| `npm run build` | `pnpm run build` |
| `npm run check:types` | `pnpm run check:types` |
| `npm run check:tests` | `pnpm run check:tests` |

Add a **VS Code Setup** section near the top:

```markdown
## VS Code Setup (Recommended)

1. Open the repository root in VS Code
2. When prompted, click **Install All** to install recommended extensions (`.vscode/extensions.json`)
3. Ensure the Biome extension is active — it provides inline lint errors and format-on-save

If not prompted, run: **Extensions: Show Recommended Extensions** from the Command Palette (`Cmd+Shift+P`).
```

Add a **Troubleshooting** section at the bottom:

```markdown
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
- Required version: pnpm 10.16+ (see `README.md`)

### Dev server port conflict

- Default port is `5173`. If occupied, Vite will try `5174`, `5175`, etc. — check the terminal output for the actual URL.
```

### Architecture References

- Architecture: "VS Code-first contributor workflow" [Source: architecture.md#Technical-Constraints-and-Dependencies]
- Architecture: "Biome is the linter and formatter" [Source: architecture.md]
- Project Context: "Biome is the sole linter/formatter. ESLint, Prettier, and PostCSS are prohibited." [Source: project-context.md#Code-Quality-Build-Rules]
- NFR17: VS Code-first developer workflow is fully documented and sufficient for solo execution [Source: prd.md]
- FR23: Contributor can execute a standard local workflow from VS Code [Source: epics.md#Epic-5]

### Package Manager: pnpm ONLY

The canonical package manager is **pnpm** — not npm. `pnpm-lock.yaml` is the lockfile. The CI uses `pnpm install --frozen-lockfile`. Any documentation using `npm run ...` is wrong and must be corrected to `pnpm run ...`.

### Do NOT Modify

- `_bmad-ui/biome.json` — Biome config is correct for Story 5.2 and must not change
- `_bmad-ui/tsconfig.json` — TS config is correct, must not change
- `.github/workflows/ci.yml` — CI is already correct
- `.github/CONTRIBUTING.md` — already uses pnpm correctly; align doc guide with this, don't contradict it
- `_bmad-ui/README.md` — separate file from `docs/development-guide-bmad-ui.md`; only touch if its VS Code guidance is wrong
- Any source code in `src/` — this story is documentation and config only

### Files to Create/Modify

| File | Action |
|---|---|
| `.vscode/extensions.json` | Create |
| `.vscode/settings.json` | Edit (add entries, preserve existing Copilot settings) |
| `docs/development-guide-bmad-ui.md` | Edit (fix `npm` → `pnpm`, add VS Code Setup section, add Troubleshooting section) |

### Verification

After completing:
1. Open a TS/TSX file — saving it should auto-format via Biome (no manual `pnpm run check:lint` needed)
2. `pnpm run check` from `_bmad-ui` passes cleanly — no regressions
3. Extensions panel → **Show Recommended Extensions** shows the 5 recommended extensions
4. `docs/development-guide-bmad-ui.md` contains no `npm` commands

### Project Structure Notes

- `.vscode/` is at the **repository root** (not inside `_bmad-ui/`) — it applies to the whole workspace
- `typescript.tsdk` must point to `_bmad-ui/node_modules/typescript/lib` not the global install
- Tailwind CSS IntelliSense does not find a config file by design — Tailwind v4 is configured via Vite plugin in `vite.config.ts`, not a separate config file

### References

- [Source: architecture.md#Technical-Constraints-and-Dependencies] — VS Code-first contributor workflow, pnpm as canonical package manager
- [Source: project-context.md#Code-Quality-Build-Rules] — Biome is the sole linter/formatter
- [Source: epics.md#Story-5.3] — Acceptance criteria and FR23 mapping
- [Source: .github/CONTRIBUTING.md] — correct pnpm-based workflow reference
- [Source: docs/development-guide-bmad-ui.md] — file to update (currently uses npm)
- [Source: .vscode/settings.json] — existing file to extend, not overwrite

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

_No blockers. Straightforward config + doc update._

### Completion Notes List

- Created `.vscode/extensions.json` with 5 recommended extensions (Biome, Tailwind CSS IntelliSense, GitLens, Copilot, Copilot Chat)
- Extended `.vscode/settings.json` with Biome as default formatter for all relevant file types, format-on-save, TypeScript SDK path, and Tailwind v4 config hints — preserving existing Copilot settings
- Updated `docs/development-guide-bmad-ui.md`: replaced all `npm` commands with `pnpm`, added VS Code Setup section, restructured dev loop, added Troubleshooting section
- `pnpm check` passes with exit code 0 (no regressions)

### File List

- `.vscode/extensions.json` (created)
- `.vscode/settings.json` (modified)
- `docs/development-guide-bmad-ui.md` (modified)
- `_bmad-output/implementation-artifacts/5-3-provide-vs-code-first-developer-workflow.md` (modified)

### Change Log

- 2026-04-18: Story 5.3 implemented — created `.vscode/extensions.json`, extended `.vscode/settings.json` with Biome formatter config, updated `docs/development-guide-bmad-ui.md` to be VS Code-first with pnpm commands and troubleshooting section.
