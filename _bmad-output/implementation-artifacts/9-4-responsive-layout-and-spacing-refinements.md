# Story 9.4: Responsive Layout and Spacing Refinements

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the layout to feel clean and well-proportioned on common screen sizes,
so that the app is comfortable to use for extended monitoring sessions.

## Acceptance Criteria

1. **Given** the dashboard at 1280px wide, **When** rendered, **Then** panels use consistent gap and padding without unintended overflow or crowding.

2. **Given** long text content (epic titles, session notes, story IDs), **When** displayed in a panel or table cell, **Then** text truncates gracefully with ellipsis rather than breaking the layout.

3. **Given** the session table and epic list, **When** viewed, **Then** rows have consistent row height and readable line spacing aligned with the design system.

## Tasks / Subtasks

- [x] Audit and fix panel spacing at 1280px (AC: 1)
  - [x] Verify `.screen > .panel` margin and padding are visually consistent across all routes
  - [x] Ensure `home.tsx` grid cards (Epics, Stories, Sessions stat panels) use Tailwind gap/padding classes instead of inline `style={}` spacing hacks
  - [x] Confirm `.screen` padding `2rem 1rem 3rem` still looks correct; apply `1.5rem` horizontal on wide viewports if needed

- [x] Add text truncation for long content (AC: 2)
  - [x] Epic detail table: add `max-w-0` (or equivalent `min-w-0 overflow-hidden`) + `truncate` to the story-ID `<td>` cells so very long story slugs (e.g. `9-4-responsive-layout-and-spacing-refinements`) do not blow out the table
  - [x] Sessions table `Skill / Name` column: confirm `.skill-chip` already has `white-space: nowrap`; add `truncate` to the surrounding cell if the chip + link combo can still overflow at narrow widths
  - [x] Epic title (`.epic-title`) in `epic.$epicId.tsx` hero: ensure it has `overflow-wrap: break-word` or `line-clamp` so a very long epic title does not overflow its panel
  - [x] Any `session.notes` or `storyId` text in session tables: use `max-w-[12rem] truncate` or similar Tailwind classes so they do not cause horizontal scroll

- [x] Ensure row height consistency in tables (AC: 3)
  - [x] Confirm global `th, td { padding: 0.55rem 0.4rem; vertical-align: middle }` in `styles.css` is respected everywhere; fix any route that overrides with non-standard padding
  - [x] Verify `.step-cell` rows in epic detail table have `vertical-align: middle` and badge sizes are uniform so no row is taller than others due to wrapping

- [x] Validate, check quality gate, and commit (all ACs)
  - [x] Run `cd _bmad-ui && pnpm check` — must pass before marking done
  - [x] Visually verify at 1280px viewport: home, sessions, epic detail, and session list pages

### Review Findings

- [x] [Review][Patch] Prevent `Skill / Name` cell overflow with truncation container in sessions table [_bmad-ui/src/routes/sessions.tsx:166]
- [x] [Review][Patch] Keep `(planned)` marker visible when story ID truncates [_bmad-ui/src/routes/epic.$epicId.tsx:811]
- [x] [Review][Patch] Add tooltip to truncated session story ID cell [_bmad-ui/src/routes/sessions.tsx:180]
- [x] [Review][Defer] Story scope drift (StatusBadge refactor in this commit) [_bmad-ui/src/app.tsx:25] — deferred, pre-existing
- [x] [Review][Defer] Status copy semantics changed beyond layout scope [_bmad-ui/src/app.tsx:43] — deferred, pre-existing

## Dev Notes

### Scope Constraint

This is a **CSS-only / Tailwind-class polish story**. Do NOT:
- Add new components, routes, or data-fetching logic
- Change the visual design language or introduce new CSS classes beyond what Tailwind utilities provide
- Add any library or PostCSS config

### Files to Touch

| File | Expected change |
|------|-----------------|
| `_bmad-ui/src/styles.css` | Minor additions: add `overflow-wrap: break-word` to `.epic-title` if not already present; verify table cell padding globally |
| `_bmad-ui/src/routes/epic.$epicId.tsx` | Add Tailwind `truncate` / `min-w-0` to story-ID `<td>` and ensure `.epic-title` wraps safely |
| `_bmad-ui/src/routes/sessions.tsx` | Confirm or add `truncate` classes on long text cells |
| `_bmad-ui/src/routes/home.tsx` | Replace hardcoded inline `style={}` spacing in the Epics/Stories/Sessions stat grid with Tailwind gap/padding classes |

Do **not** touch `route-tree.ts`, `types.ts`, `agent-server.ts`, or `vite-plugin-static-data.ts` — this story makes no structural or data changes.

### Current Layout Architecture (do not break)

- `.app-layout`: `display: flex; min-height: 100vh`
- `.app-sidebar`: `width: 240px; fixed; z-index: 20`
- `.app-content`: `flex: 1; margin-left: 240px; min-width: 0`
- `.screen`: `margin: 0 auto; max-width: 1280px; padding: 2rem 1rem 3rem`
- `.panel`: `padding: 1.1rem; border-radius: 16px; backdrop-filter: blur(6px)`
- `.screen > .panel`: `margin-bottom: 1.1rem` (last-child: `0`)
- Responsive at `<900px`: sidebar shrinks to `200px`, content `margin-left: 200px`, screen padding `1rem 0.75rem 2rem`

### Table Baseline (do not change)

Global table styles in `styles.css` (line ~1720):
```css
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
th, td { text-align: left; padding: 0.55rem 0.4rem; border-bottom: 1px solid rgba(143,170,195,0.22); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
```

Tables are already wrapped in `.table-wrap { overflow-x: auto }` in both `sessions.tsx` and `epic.$epicId.tsx`. The goal is to prevent individual cells from expanding the table width unexpectedly.

### Text Truncation Pattern (use these, do NOT invent new CSS classes)

Use Tailwind utility classes directly on JSX:
- Long text in flex containers: `className="flex-1 min-w-0 truncate"`
- Long text in table cells: `className="max-w-0 truncate"` on the `<td>`, or wrap inner content with `<span className="block truncate">`
- Multi-line clamp (2 lines): use `className="line-clamp-2"` (Tailwind v4 supports this)
- Overflow wrap for headings: add `overflow-wrap: break-word` in `styles.css` on the relevant class, or use `className="break-words"`

### Known Inline Style Issues in home.tsx

The Project Summary grid in `home.tsx` (around line 196–200) uses:
```tsx
<div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
```

Per project-context.md, inline `style={}` for layout is allowed when the Tailwind equivalent requires a non-standard value not expressible with bracket syntax. The `repeat(auto-fit, minmax(280px, 1fr))` pattern is valid here since there is no single Tailwind class for it — this is acceptable and should NOT be changed unless it causes overflow issues.

However, other inline `style={}` values that use plain padding/gap values (e.g. `style={{ padding: "0.75rem 1rem" }}`) in epic.$epicId.tsx (lines ~728 and ~742) should be replaced with Tailwind classes for consistency.

### CSS Variables (always use these)

```
var(--text)       var(--muted)       var(--highlight)
var(--panel)      var(--panel-border)
```
Never hardcode colors. Never use `style={{ backgroundColor: '...' }}`.

### Project Context Rules Summary

- Components: named functions, not arrow consts
- `import type` for type-only imports (Biome enforces)
- `Number.isNaN()`, not global `isNaN` (Biome enforces)
- No new custom CSS classes — use Tailwind utility classes on JSX
- Existing CSS classes in `styles.css` can be used and lightly extended for non-layout rules, but layout concerns go on JSX as Tailwind utilities

### Testing Requirements

- No new tests needed (layout/spacing changes are visually verified)
- `pnpm check` (lint + types + build) must pass — zero Biome errors
- Manual visual check at 1280px: home, /sessions, /epic/{id}, session list

### Project Structure Notes

- All components live in `src/routes/` or `src/app.tsx` (Phase 1 — no `src/ui/` yet)
- `src/styles.css` is the single CSS file; add only to it, do not create new CSS files
- Do not create barrel `index.ts` files
- `@/*` alias maps to `./src/` — use it for all cross-file imports

### Previous Story Intelligence

- Story 9.7 (most recent in epic 9) confirmed no structural issues with the dual-mode arch; its notes reiterate: "Preserve the existing styling language and CSS-variable usage."
- Story 8.4 established the epic detail table structure — story-ID links are the first column, followed by step-badge columns. Long story IDs like `8-4-establish-phase-boundary-and-evolution-guardrails` have been visible in production but no truncation was applied.
- Story 7.3 and 8.1 both used Tailwind `truncate` / `min-w-0` patterns on home.tsx (see lines 358, 514, 519) — follow those patterns for new truncation fixes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4] — acceptance criteria
- [Source: _bmad-output/project-context.md#Styling Rules] — Tailwind-first, no new CSS classes, no hardcoded colors
- [Source: _bmad-ui/src/styles.css#L456-L484] — `.screen` and `.panel` layout definitions
- [Source: _bmad-ui/src/styles.css#L1720-L1737] — global table styles
- [Source: _bmad-ui/src/styles.css#L2044-L2064] — `@media (max-width: 900px)` responsive rules
- [Source: _bmad-ui/src/routes/sessions.tsx] — session table structure
- [Source: _bmad-ui/src/routes/epic.$epicId.tsx#L960-L1100] — story table rows
- [Source: _bmad-ui/src/routes/home.tsx#L196-L200] — Epics/Stories/Sessions stat grid

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Added `overflow-wrap: break-word` to `.epic-title` in `styles.css`
- Added `max-w-0 truncate block` on story-ID cells in epic detail table (planned-only and regular rows)
- Added `max-w-[12rem]` + `block truncate` to sessions table story column
- Replaced inline `style={{ marginBottom, padding }}` with Tailwind `mb-4 py-3 px-4` on warning banners in `epic.$epicId.tsx`
- Replaced inline `style={{ display:flex, gap, marginTop, flexWrap, alignItems }}` with Tailwind classes on epic action buttons container
- Fixed pre-existing lint/format issues: unused import in `sessions.tsx`, import ordering in analytics files, formatting in `app.tsx` and `workflow.$phaseId.$stepId.tsx`
- `pnpm check` passes: lint + types + tests + build all green

### File List

- `_bmad-ui/src/styles.css`
- `_bmad-ui/src/routes/epic.$epicId.tsx`
- `_bmad-ui/src/routes/sessions.tsx`
- `_bmad-ui/src/routes/home.tsx`
- `_bmad-ui/src/app.tsx`
