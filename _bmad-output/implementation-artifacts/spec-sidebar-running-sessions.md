---
title: 'Add running sessions list to sidebar'
type: 'feature'
created: '2026-04-16'
status: 'done'
route: 'one-shot'
context: []
---

## Intent

**Problem:** The sidebar shows a static "Sessions" link but gives no visibility into which sessions are currently running without navigating to the sessions page.

**Approach:** Fetch sessions from `/api/analytics` with TanStack Query polling (10s interval), filter for `status === "running"`, and render them as clickable links below the Sessions nav link using existing sidebar session CSS classes.

## Suggested Review Order

1. [src/main.tsx](../../_bmad-ui/src/main.tsx) — QueryClientProvider setup for TanStack Query
2. [src/routes/__root.tsx](../../_bmad-ui/src/routes/__root.tsx#L1-L10) — New imports and constants
3. [src/routes/__root.tsx](../../_bmad-ui/src/routes/__root.tsx#L220-L245) — useQuery hook for running sessions + sidebar rendering
