# Story 11.2: Extract Sprint & Overview Domain

Status: done

## Story

As a maintainer,
I want sprint summarization and overview construction extracted into `scripts/server/sprint/` with collocated types,
so that the complex sprint aggregation logic — how workflow progress is computed and presented — is navigable independently from runtime, analytics, and routing concerns.

## Acceptance Criteria

1. A `scripts/server/sprint/` folder exists with three files: `overview.ts`, `summarize.ts`, `index.ts`
2. `summarize.ts` contains all listed types, constants, and sprint computation functions — moved from `agent-server.ts`
3. `overview.ts` contains `SprintOverview` type and `buildOverviewPayload` function (see Dev Notes for dependency handling)
4. `index.ts` re-exports the full public API of the sprint domain
5. `agent-server.ts` imports from `./server/sprint` and re-exports those symbols in its own export block — no behavior change
6. `pnpm check` passes with zero lint, type, test, or build errors
7. All behavior is identical before and after — this is a pure refactoring

## Tasks / Subtasks

- [ ] Task 1: Create `scripts/server/sprint/summarize.ts` (AC: 2)
  - [ ] Move types: `StoryStatus`, `EpicStatus`, `WorkflowStepState`, `StoryWorkflowStepSkill`, `EpicWorkflowStepSkill`, `EpicLifecycleSteps`
  - [ ] Move constants: `STORY_WORKFLOW_STEPS`, `EPIC_WORKFLOW_STEPS`, `sprintStatusFile`, `SPRINT_STORY_STATUS_REGEX`, `EPIC_STATUS_REGEX`, `EPIC_PLANNING_REGEX`, `EPIC_RETROSPECTIVE_REGEX`, `STORY_STATUS_ORDER`
  - [ ] Move functions: `toStepState`, `deriveStoryStepStateFromStatus`, `deriveEpicStatusFromStories`, `summarizeSprint`, `summarizeSprintFromEpics`, `summarizeEpicSteps`, `loadSprintOverview`, `applyStoryStatusOverridesFromMarkdown`, `loadStoryStatusesFromMarkdown`, `recomputeSprintOverviewCounts`
  - [ ] Add Node.js imports (`path`, `fs`, `fs/promises`) needed by moved functions
  - [ ] Import `paths.ts` for `artifactsRoot` (established in Story 11.1)
  - [ ] Import `slugifyStoryLabel` from `../epics` OR inline the copy (see Dev Notes)

- [ ] Task 2: Create `scripts/server/sprint/overview.ts` (AC: 3)
  - [ ] Move `SprintOverview` type here
  - [ ] See Dev Notes for `buildOverviewPayload` placement decision

- [ ] Task 3: Create `scripts/server/sprint/index.ts` (AC: 4)
  - [ ] Re-export all public symbols from `overview.ts` and `summarize.ts`

- [ ] Task 4: Update `agent-server.ts` (AC: 5)
  - [ ] Replace inline definitions with imports from `./server/sprint`
  - [ ] Ensure export block still exposes `loadSprintOverview`, `STORY_WORKFLOW_STEPS`, `deriveStoryStepStateFromStatus`, `buildOverviewPayload`
  - [ ] Remove all moved code — no duplicates

- [ ] Task 5: Verify quality gate (AC: 6, 7)
  - [ ] Run `cd _bmad-custom/bmad-ui && pnpm check`
  - [ ] Fix any type errors from broken imports in consuming code

## Dev Notes

### Prerequisite: Story 11.1 Must Be Done

This story depends on the runtime domain being extracted. Before starting:
- `scripts/server/runtime/` must exist with `state.ts`, `sessions.ts`, `index.ts`
- `scripts/server/paths.ts` must exist exporting `projectRoot` and `artifactsRoot`
- `zod` must be installed (`pnpm add zod` was done in 11.1)

Check: `ls _bmad-custom/bmad-ui/scripts/server/` should show `paths.ts` and `runtime/`

### Target File Structure

```
_bmad-custom/bmad-ui/scripts/server/sprint/
├── index.ts       — re-exports from overview.ts and summarize.ts
├── overview.ts    — SprintOverview type + (see buildOverviewPayload note below)
└── summarize.ts   — all types, constants, and sprint computation functions
```

### `buildOverviewPayload` Cross-Domain Dependency Problem

`buildOverviewPayload` (line 878 in `agent-server.ts`) is an orchestration function that calls:
- **runtime domain** (already extracted): `ensureRunningProcessStateIsFresh`, `runningProcess`, `runningProcessCanAcceptInput`, `activeWorkflowSkill`, `runningSessionProcesses`, `markZombieAnalyticsSessionsFailed`, `analyticsToRuntimeSession`
- **analytics domain** (extracted in Story 11.5): `readAnalyticsStore`, `readAgentSessionsFile`
- **epics domain** (extracted in Story 11.3): `parseEpicMarkdownRows`, `buildDependencyTree`, `summarizeEpicConsistency`, `loadStoryDependencies`
- **sprint domain** (this story): `loadSprintOverview`, `summarizeEpicSteps`, `STORY_WORKFLOW_STEPS`

**Recommended approach for this story:**
- Put `SprintOverview` type in `overview.ts`
- Leave `buildOverviewPayload` in `agent-server.ts` — it will move to `scripts/server/routes/overview.ts` in Story 11.6 when all domains are available
- Add a `// TODO Story 11.6: move buildOverviewPayload to scripts/server/routes/overview.ts` comment at the function site
- `overview.ts` thus contains only the `SprintOverview` type for now (this is acceptable — it will grow in 11.6)

This avoids a circular dependency: `agent-server.ts` → `sprint/overview.ts` → `agent-server.ts`.

### `slugifyStoryLabel` Cross-Domain Usage

`slugifyStoryLabel` (line 962) is called by `summarizeSprintFromEpics` but belongs conceptually to the epics domain (it processes epic story heading text). Two options:
1. **Duplicate it temporarily** in `summarize.ts` with a `// TODO Story 11.3: import from ../epics` comment
2. **Inline it** directly at the call site in `summarizeSprintFromEpics`

Option 1 is cleaner. The epics story (11.3) will remove the duplication.

### Exact Functions to Move to `summarize.ts`

All of these live in `agent-server.ts` and must move. Lines are approximate:

| Function/Constant | Lines (approx) | Notes |
|---|---|---|
| `StoryStatus` type | 26–31 | |
| `EpicStatus` type | 32 | |
| `StoryWorkflowStepSkill` type | 33–36 | |
| `EpicWorkflowStepSkill` type | 38–41 | |
| `EpicLifecycleSteps` type | 43 | |
| `WorkflowStepState` type | 45 | |
| `STORY_WORKFLOW_STEPS` const | 184–191 | |
| `EPIC_WORKFLOW_STEPS` const | 193–200 | |
| `sprintStatusFile` const | 170–174 | Import `artifactsRoot` from `../paths` |
| `SPRINT_STORY_STATUS_REGEX` const | 350–351 | |
| `EPIC_STATUS_REGEX` const | 352 | |
| `EPIC_PLANNING_REGEX` const | 353 | |
| `EPIC_RETROSPECTIVE_REGEX` const | 354 | |
| `STORY_STATUS_ORDER` const | 386–392 | |
| `toStepState` function | 2011–2022 | |
| `deriveStoryStepStateFromStatus` function | 2024–2048 | |
| `deriveEpicStatusFromStories` function | 2050–2070 | |
| `summarizeSprint` function | 2072–2337 | |
| `summarizeSprintFromEpics` function | 972–1193 | Calls `slugifyStoryLabel` — duplicate or inline |
| `summarizeEpicSteps` function | 2339–2356 | |
| `loadSprintOverview` function | 1195–1267 | Async; needs `readFile`, `existsSync`, `path` |
| `applyStoryStatusOverridesFromMarkdown` function | 1269–1313 | Async |
| `loadStoryStatusesFromMarkdown` function | 1315–1365 | Async; needs `readdir`, `readFile` |
| `recomputeSprintOverviewCounts` function | 1367–1414 | |

**Note:** `EPICS_STORY_HEADING_REGEX`, `EPICS_EPIC_HEADING_WITH_NAME_REGEX`, `EPICS_EPIC_HEADING_REGEX` are used by `loadSprintOverview` and `summarizeSprintFromEpics`. These belong conceptually to the epics domain (Story 11.3), but are needed here now. Options:
- Copy them into `summarize.ts` with `// TODO Story 11.3: import from ../epics`
- Or move them early to a shared location

`STORY_MARKDOWN_STATUS_REGEX` and `STORY_ID_PREFIX_REGEX` are used by `loadStoryStatusesFromMarkdown`. Move them to `summarize.ts`.

### Consuming Code That Imports Sprint Functions

After the move, these references in `agent-server.ts` must be updated to import from `./server/sprint`:
- `buildOverviewPayload` uses: `loadSprintOverview`, `summarizeEpicSteps`, `STORY_WORKFLOW_STEPS` (lines 878–960)
- `updateSprintStoryStatus` (line 4587) uses `deriveStoryStepStateFromStatus`
- `SPRINT_STORY_STATUS_REGEX` is used at line 3538
- Export block re-exports `loadSprintOverview`, `STORY_WORKFLOW_STEPS`, `deriveStoryStepStateFromStatus` (lines 5412, 5417, 5402)

Also check `vite-plugin-static-data.ts` — it imports from `agent-server.ts`. If it uses any sprint symbols, those imports will continue to work since agent-server.ts re-exports them.

### `SessionAnalyticsData` Type Dependency

`summarizeSprint`, `summarizeSprintFromEpics`, `loadSprintOverview`, and `summarizeEpicSteps` accept `sessions: SessionAnalyticsData[]` as a parameter. `SessionAnalyticsData` is defined in `agent-server.ts` around line 2947 and belongs to the analytics domain (Story 11.5).

**For this story:** import `SessionAnalyticsData` type from `agent-server.ts`? No — circular.

**Recommended approach:** Define a local minimal type alias in `summarize.ts` with only the fields consumed by sprint functions (`storyId`, `skill`, `status`, `startedAt`), or use a structural type. Add a `// TODO Story 11.5: replace with import from ../analytics` comment.

Fields used by sprint functions from `SessionAnalyticsData`:
- `session.storyId` (`string | null | undefined`)
- `session.skill` (`string`)
- `session.status` (`string`)
- `session.startedAt` (`string`)

### Import Pattern in `agent-server.ts` After Extraction

```typescript
// At top of agent-server.ts, after Story 11.2:
import {
  type SprintOverview,
  type StoryStatus,
  type EpicStatus,
  type WorkflowStepState,
  type StoryWorkflowStepSkill,
  type EpicWorkflowStepSkill,
  STORY_WORKFLOW_STEPS,
  EPIC_WORKFLOW_STEPS,
  loadSprintOverview,
  summarizeEpicSteps,
  deriveStoryStepStateFromStatus,
  recomputeSprintOverviewCounts,
  SPRINT_STORY_STATUS_REGEX,
  STORY_STATUS_ORDER,
} from "./server/sprint/index.js"
```

Note: **`.js` extension required** — this is an ES Modules project (`"type": "module"` in package.json). All local imports in `.ts` files must use `.js` extension (TypeScript resolves `.ts` at compile time).

### Project Structure Notes

- New files land at: `_bmad-custom/bmad-ui/scripts/server/sprint/`
- This mirrors the already-existing `_bmad-custom/bmad-ui/scripts/server/runtime/` from Story 11.1
- `scripts/server/paths.ts` already exports `projectRoot` and `artifactsRoot` — use it instead of re-deriving them

### Code Quality Rules (project-context.md)

- Named functions, not arrow-function consts for top-level functions
- `import type { ... }` for type-only imports — Biome enforces `useImportType`
- `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()` — Biome enforces
- Magic numbers as named `const` at top of file
- No barrel `index.ts` with re-exports-only is the one exception allowed (`noBarrelFile` rule applies to feature-level barrels; domain `index.ts` files are the intended export surface)
- Run `pnpm check` (lint + types + tests + build) before committing

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.2] — acceptance criteria + target structure
- [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#lines 26–45] — types to extract
- [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#lines 184–200] — WORKFLOW_STEPS constants
- [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#lines 972–1414] — sprint domain functions
- [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#lines 2011–2356] — helper + summarize functions
- [Source: _bmad-output/project-context.md] — code quality rules, ES module `.js` imports

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
