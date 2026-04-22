---
title: 'Persist orchestration state across page reloads'
type: 'feature'
created: '2026-04-16'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Clicking "Develop all stories" sets `isOrchestrating` in React state, which is lost on page reload. The button re-enables and the orchestration driver stops firing, so agents don't continue processing remaining stories.

**Approach:** Persist the orchestrating flag per epic in `localStorage`, initialize from it on mount, and clear it when orchestration completes. Add a "Stop" button so users can manually cancel if orchestration stalls.

## Suggested Review Order

1. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L15) — new `ORCHESTRATING_STORAGE_PREFIX` constant
2. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L138-L144) — `orchestratingKey` + `useState` initializer reading from localStorage with try/catch
3. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L384-L393) — `handleDevelopAllStories` now writes to localStorage
4. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L395-L401) — new `handleStopOrchestration` callback
5. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L472-L477) — cleanup in orchestration effect clears localStorage on completion
6. [epic.$epicId.tsx](../../_bmad-ui/src/routes/epic.$epicId.tsx#L585-L598) — "Stop" button rendered alongside orchestrating indicator
7. [deferred-work.md](../../_bmad-output/implementation-artifacts/deferred-work.md) — deferred review findings (TTL, multi-tab, cross-tab sync, zombie keys, richer metadata)
