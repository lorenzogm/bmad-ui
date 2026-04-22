# Story 11.3: Extract Epic & Story Domain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want epic markdown parsing, story dependencies, and story content extraction into `scripts/server/epics/` with collocated types,
so that the planning artifact interpretation logic is isolated and testable independently.

## Acceptance Criteria

1. **Given** the sprint domain from Story 11.2, **When** the epic domain is extracted, **Then** a `scripts/server/epics/` folder exists with:
   - `parser.ts` — `ParsedEpicMarkdownRow` type, all `EPICS_*` regex constants, `STORY_ID_PREFIX_REGEX`, `epicsFile` path, and functions: `parseEpicMarkdownRows`, `getEpicMetadataFromMarkdown`, `getStoryContentFromEpics`, `getPlannedStoriesFromEpics`, `findStoryMarkdown`, `slugifyStoryLabel`
   - `dependencies.ts` — `DependencyTreeNode`, `EpicConsistency` types, `storyDependenciesFile` path, `YAML_STORY_HEADER_REGEX`, `YAML_DEP_ITEM_REGEX`, `YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX`, and functions: `buildDependencyTree`, `loadStoryDependencies`, `summarizeEpicConsistency`, `updateSprintStoryStatus`, `escapeRegExp`, `syncEpicStatusInSprintContent`, `deriveEpicStatusFromStories`
   - `index.ts` — re-exporting the public API of both files

2. **Given** the extraction is complete, **When** `pnpm check` is run, **Then** lint, types, tests, and build all pass with zero regressions

3. **Given** the original `agent-server.ts` behavior, **When** compared before and after, **Then** all behavior is identical — this is a pure refactoring with no functional changes

## Tasks / Subtasks

- [ ] Create `scripts/server/epics/parser.ts` (AC: 1)
  - [ ] Move `ParsedEpicMarkdownRow` type
  - [ ] Move constants: `EPICS_MARKDOWN_ROW_REGEX`, `EPICS_STORY_HEADING_REGEX`, `EPICS_EPIC_HEADING_REGEX`, `EPICS_EPIC_HEADING_WITH_NAME_REGEX`, `EPICS_STORY_FALLBACK_LABEL`, `EPIC_DEPENDENCY_NUMBER_REGEX`, `STORY_ID_PREFIX_REGEX`
  - [ ] Move `epicsFile` path constant — import `artifactsRoot` from `../paths`
  - [ ] Move functions: `slugifyStoryLabel`, `parseEpicMarkdownRows`, `getEpicMetadataFromMarkdown`, `getStoryContentFromEpics`, `getPlannedStoriesFromEpics`, `findStoryMarkdown`
  - [ ] `findStoryMarkdown` needs `artifactsRoot` and `projectRoot` from `../paths`

- [ ] Create `scripts/server/epics/dependencies.ts` (AC: 1)
  - [ ] Move types: `DependencyTreeNode`, `EpicConsistency`
  - [ ] Move `storyDependenciesFile` path constant — derive from `projectRoot` via `../paths`
  - [ ] Move constants: `YAML_STORY_HEADER_REGEX`, `YAML_DEP_ITEM_REGEX`, `YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX`
  - [ ] Move functions: `escapeRegExp`, `deriveEpicStatusFromStories`, `syncEpicStatusInSprintContent`, `loadStoryDependencies`, `buildDependencyTree`, `summarizeEpicConsistency`, `updateSprintStoryStatus`
  - [ ] `buildDependencyTree` and `summarizeEpicConsistency` accept `SprintOverview` as a parameter — import `SprintOverview` type from `../sprint` (Story 11.2 must be done first)
  - [ ] `updateSprintStoryStatus` reads/writes `sprintStatusFile` — import `sprintStatusFile` from `../sprint`
  - [ ] `deriveEpicStatusFromStories` uses `EpicStatus` and `StoryStatus` types — import from `../sprint`

- [ ] Create `scripts/server/epics/index.ts` (AC: 1)
  - [ ] Re-export everything public from `parser.ts` and `dependencies.ts`
  - [ ] Suppress `noBarrelFile` Biome rule: `// biome-ignore lint/performance/noBarrelFile: domain public API boundary`

- [ ] Update `agent-server.ts` to import from domain module (AC: 2, 3)
  - [ ] Replace inline type/constant/function definitions with imports from `./server/epics`
  - [ ] Ensure all named exports still exported from `agent-server.ts`: `epicsFile`, `findStoryMarkdown`, `getEpicMetadataFromMarkdown`, `getPlannedStoriesFromEpics`, `getStoryContentFromEpics`
  - [ ] Remove the now-redundant definitions from `agent-server.ts`

- [ ] Run quality gate (AC: 2)
  - [ ] `cd _bmad-ui && pnpm check` — lint + types + tests + build must pass

## Dev Notes

### This is a Pure Refactoring Story

**Zero functional changes.** Every function extracted must behave identically. The only observable change is file organization.

### Prerequisites

Story 11.1 must be done first — `scripts/server/paths.ts` must exist, exporting `projectRoot` and `artifactsRoot`.

Story 11.2 must be done first — `scripts/server/sprint/` must exist, exporting `SprintOverview` type, `EpicStatus`, `StoryStatus`, and `sprintStatusFile` path constant. Both `buildDependencyTree` and `summarizeEpicConsistency` accept `SprintOverview` as a parameter; `updateSprintStoryStatus` writes to `sprintStatusFile`.

**If stories 11.1 and/or 11.2 are not yet merged**, temporarily import from `agent-server.ts` directly as placeholders and leave a TODO comment, then replace after the prereq stories are done.

### Project Root

The project lives at `_bmad-ui/`. All script paths are relative to there:
- `scripts/agent-server.ts` — the 5,420-line monolith being modularized
- `scripts/server/paths.ts` — provides `projectRoot` and `artifactsRoot` (created in Story 11.1)
- `scripts/server/sprint/` — provides sprint types and `sprintStatusFile` (created in Story 11.2)
- `scripts/vite-plugin-static-data.ts` — imports from `agent-server.ts`

Target structure after this story:

```
scripts/server/
├── paths.ts                 — (Story 11.1)
├── runtime/                 — (Story 11.1)
├── sprint/                  — (Story 11.2)
└── epics/
    ├── index.ts             — re-exports
    ├── parser.ts            — ParsedEpicMarkdownRow, EPICS_* regexes, parsing functions
    └── dependencies.ts      — DependencyTreeNode, EpicConsistency, YAML regexes, dep functions
```

### Exact Code Locations in agent-server.ts (as of story creation, 5,420 lines)

**Types to move:**
- `ParsedEpicMarkdownRow` — line 129 → `parser.ts`
- `DependencyTreeNode` — line 121 → `dependencies.ts`
- `EpicConsistency` — line 136 → `dependencies.ts`

**Constants to move:**
- `EPICS_MARKDOWN_ROW_REGEX` — line 355 → `parser.ts`
- `EPICS_STORY_HEADING_REGEX` — line 357 → `parser.ts`
- `EPICS_EPIC_HEADING_REGEX` — line 358 → `parser.ts`
- `EPICS_EPIC_HEADING_WITH_NAME_REGEX` — line 359 → `parser.ts`
- `EPICS_STORY_FALLBACK_LABEL` — line 360 → `parser.ts`
- `EPIC_DEPENDENCY_NUMBER_REGEX` — line 361 → `parser.ts`
- `STORY_ID_PREFIX_REGEX` — line 2445 → `parser.ts` (also used in `dependencies.ts`, import from `parser.ts`)
- `YAML_STORY_HEADER_REGEX` — line 377 → `dependencies.ts`
- `YAML_DEP_ITEM_REGEX` — line 378 → `dependencies.ts`
- `YAML_COMMENT_REGEX` — line 376 → `dependencies.ts`
- `LAST_UPDATED_COMMENT_REGEX` — line 375 → `dependencies.ts`
- `epicsFile` — line 175 → `parser.ts` (import `artifactsRoot` from `../paths`)
- `storyDependenciesFile` — line 176 → `dependencies.ts` (import `projectRoot` from `../paths`)

**Functions to move:**
- `slugifyStoryLabel` — line 962 → `parser.ts`
- `parseEpicMarkdownRows` — line 2358 → `parser.ts`
- `getEpicMetadataFromMarkdown` — line 2408 → `parser.ts`
- `getStoryContentFromEpics` — line 2447 → `parser.ts`
- `getPlannedStoriesFromEpics` — line 2502 → `parser.ts`
- `findStoryMarkdown` — line 2871 → `parser.ts` (imports `artifactsRoot`, `projectRoot` from `../paths`)
- `escapeRegExp` — line 2640 → `dependencies.ts`
- `deriveEpicStatusFromStories` — line 2050 → `dependencies.ts`
- `syncEpicStatusInSprintContent` — line 2644 → `dependencies.ts`
- `loadStoryDependencies` — line 2594 → `dependencies.ts`
- `buildDependencyTree` — line 2547 → `dependencies.ts`
- `summarizeEpicConsistency` — line 2522 → `dependencies.ts`
- `updateSprintStoryStatus` — line 2694 → `dependencies.ts`

### Cross-Domain Type Dependencies

`dependencies.ts` uses `SprintOverview`, `EpicStatus`, and `StoryStatus` — these are sprint domain types from Story 11.2. Import them from `../sprint`:

```ts
import type { EpicStatus, SprintOverview, StoryStatus } from "../sprint"
```

`updateSprintStoryStatus` uses `sprintStatusFile` — import from `../sprint`:

```ts
import { sprintStatusFile } from "../sprint"
```

### `noBarrelFile` Biome Rule

The project enforces `noBarrelFile`. Suppress with:

```ts
// biome-ignore lint/performance/noBarrelFile: domain public API boundary
export * from "./parser"
export * from "./dependencies"
```

### `YAML_COMMENT_REGEX` and `LAST_UPDATED_COMMENT_REGEX` Shared Usage Warning

`YAML_COMMENT_REGEX` is currently also referenced by `parseSimpleYamlList` (links-notes domain, Story 11.6) and `LAST_UPDATED_COMMENT_REGEX` is used by `updateSprintStoryStatus` (epics domain). For now, define both in `dependencies.ts`. When Story 11.6 extracts the links-notes domain, it will define its own copy rather than importing from the epics domain — intentional duplication to avoid cross-domain coupling.

### Consumer Exports That Must Keep Working

`vite-plugin-static-data.ts` imports these names from `agent-server.ts` that will move to the epics domain:

```ts
epicsFile, findStoryMarkdown, getEpicMetadataFromMarkdown,
getPlannedStoriesFromEpics, getStoryContentFromEpics
```

After extraction, `agent-server.ts` must re-export all of these from the epics domain:

```ts
export { epicsFile, findStoryMarkdown, getEpicMetadataFromMarkdown,
         getPlannedStoriesFromEpics, getStoryContentFromEpics } from "./server/epics"
```

### `StoryStatus` Type Used in `dependencies.ts`

`deriveEpicStatusFromStories` accepts `byStoryStatus: Record<StoryStatus, number>`. `StoryStatus` is currently defined in `agent-server.ts` (line 26) and will move to the sprint domain in Story 11.2. Import it from `../sprint`.

### `STORY_MARKDOWN_STATUS_REGEX` and `STORY_STATUS_ORDER`

These constants (lines 384-392) are used by `loadSprintOverview` in the sprint domain and by the route handlers — they are sprint domain concerns. Do NOT move them to the epics domain. Leave them in the sprint domain (Story 11.2) or in `agent-server.ts` for now.

### ESM-Safe Imports

All new files in `scripts/server/` must use ESM-compatible patterns. Do not use `__dirname` directly. The `paths.ts` file (Story 11.1) already handles ESM-safe `__dirname` resolution — import `projectRoot` and `artifactsRoot` from there rather than re-implementing the pattern.

### TypeScript Strict Mode Considerations

- `noUnusedLocals` and `noUnusedParameters` are enabled — when moving constants, ensure none are left dangling in `agent-server.ts`
- `YAML_COMMENT_REGEX` is currently used by both `loadStoryDependencies` (moving to epics) and `parseSimpleYamlList` (staying in agent-server.ts for now). Keep a copy in `agent-server.ts` until Story 11.6 moves `parseSimpleYamlList` to links-notes domain
- After extraction, verify the remaining usages of all moved constants in `agent-server.ts` — if a constant is referenced only via the domain import now, ensure the original definition is removed

### Build System Note

The `scripts/` folder is not covered by the project `tsconfig.json` — it's executed via Vite/Node. Type errors are caught at dev-server startup and during `vite build`. Run `pnpm check` (which includes `tsc --noEmit && vite build`) to validate.

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story 11.3]
- Epic decomposition principles: [Source: _bmad-output/planning-artifacts/epics.md#Epic 11]
- Story 11.1 (paths.ts, runtime domain): [Source: _bmad-output/implementation-artifacts/11-1-extract-runtime-domain.md]
- Source monolith: `_bmad-ui/scripts/agent-server.ts` (5,420 lines as of story creation)
- Consumer: `_bmad-ui/scripts/vite-plugin-static-data.ts`
- Consumer: `_bmad-ui/vite.config.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
