---
title: 'Use epics.md fallback for epics and stories'
type: 'bugfix'
created: '2026-04-15'
status: 'done'
route: 'one-shot'
---

# Use epics.md fallback for epics and stories

## Intent

**Problem:** The UI failed to show epics and stories when `sprint-status.yaml` was missing, and the fallback did not consistently read from the planning artifact source.

**Approach:** Point the backend to `_bmad-output/planning-artifacts/epics.md`, derive sprint overview data from markdown story/epic headings when needed, and keep API detail endpoints using the same fallback loader.

## Suggested Review Order

- Verify canonical epics source path and parser entrypoints.
  [vite.config.ts:150](../../_bmad-ui/vite.config.ts#L150)

- Confirm robust story/epic markdown heading matching.
  [vite.config.ts:226](../../_bmad-ui/vite.config.ts#L226)

- Check fallback synthesis from `epics.md` into sprint overview objects.
  [vite.config.ts:463](../../_bmad-ui/vite.config.ts#L463)

- Ensure all API overview/detail flows share the same fallback loader.
  [vite.config.ts:644](../../_bmad-ui/vite.config.ts#L644)

- Validate TypeScript lib target supports modern APIs used by current code.
  [tsconfig.json:3](../../_bmad-ui/tsconfig.json#L3)
