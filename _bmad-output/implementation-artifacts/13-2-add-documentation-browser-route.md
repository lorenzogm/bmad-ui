# Story 13.2: Add Documentation Browser Route (`/docs`)

Status: done

## Story

As a user,
I want a dedicated Docs page at `/docs`,
so that I can browse key project documentation files.

## Acceptance Criteria

1. **Given** navigating to `/docs`, **When** the page loads, **Then** a grid of documentation cards is shown.

2. **Given** the docs page, **When** in local mode, **Then** each card is a clickable link that opens the file.

3. **Given** the docs page, **When** in production mode, **Then** cards display with no clickable behavior.

4. **Given** the sidebar, **When** on `/docs`, **Then** the 📚 Docs link shows as active.

## Tasks / Subtasks

- [x] Create `_bmad-ui/src/routes/docs.tsx` with `DocsPage` component and `docsRoute`
- [x] Define `KNOWN_DOCS` static list with README, Setup Guide, Deployment Guide, Contributing
- [x] Display docs as card grid with dark theme styling using CSS variables
- [x] Register `docsRoute` in `route-tree.ts`
- [x] Verify `pnpm check` passes

## Dev Notes

- Uses static `KNOWN_DOCS` constant — no backend API needed
- `IS_LOCAL_MODE` gates whether cards are `<a>` links or plain `<div>` cards
- Styled with `var(--panel)`, `var(--highlight)`, `var(--muted)`, `var(--panel-border)`
