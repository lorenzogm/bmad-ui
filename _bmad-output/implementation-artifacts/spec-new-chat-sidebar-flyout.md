---
title: 'New Chat Sidebar Flyout'
type: 'feature'
created: '2026-04-16'
status: 'done'
route: 'one-shot'
---

# New Chat Sidebar Flyout

## Intent

**Problem:** Users can only run skills via the BMAD workflow UI — there is no way to manually specify a skill name and custom prompt from the sidebar.

**Approach:** Add a "+ New Chat" toggle at the bottom of the sidebar that opens an inline flyout with a skill input and optional prompt textarea. On submit, it calls the existing `/api/workflow/run-skill` API and navigates to the new session page.

## Suggested Review Order

1. [__root.tsx](../../../_bmad-custom/bmad-ui/src/routes/__root.tsx) — New `NewChatFlyout` component and sidebar trigger button. Core interaction: form state, API call, navigation on success, ARIA attributes.
2. [agent-server.ts](../../../_bmad-custom/bmad-ui/scripts/agent-server.ts) — API extension: `prompt` field in request body, sanitization (length cap + control char stripping), rejection of `prompt` + `storyId`/`epicId` combo.
3. [styles.css](../../../_bmad-custom/bmad-ui/src/styles.css) — `.new-chat-*` classes and `.sidebar-spacer`/`.new-chat-trigger` positioning.
4. [deferred-work.md](deferred-work.md) — Focus management item deferred for later.
