# GitHub Copilot Instructions

## Project Overview

BMAD UI — a dashboard for monitoring BMAD multi-agent workflows, sprint progress, and AI agent sessions. Built as a single-page React app inside a monorepo.

## Key Files

- `_bmad-custom/bmad-ui/src/app.tsx` — all components and page logic
- `_bmad-custom/bmad-ui/src/styles.css` — all styles (dark theme, CSS variables)
- `_bmad-custom/bmad-ui/src/types.ts` — shared TypeScript types
- `_bmad-output/planning-artifacts/` — BMAD artifact outputs (prd.md, architecture.md, epics.md, etc.)
- `_bmad-output/implementation-artifacts/` — spec files for development work
- `_bmad-output/project-context.md` — detailed AI rules (always read this)

## Always Read project-context.md First

Load `_bmad-output/project-context.md` before making any code changes. It contains critical rules for TypeScript, React, Tailwind, imports, and code quality.

## Tech Stack

- **React** 19.2.0 + **Vite** 7 + **TypeScript** 5.9
- **TanStack Router** — manual route tree registration in `src/routes/route-tree.ts`
- **Tailwind CSS v4** via Vite plugin
- **Biome** linter (NOT ESLint/Prettier)

## Design System — Critical Rules

The app uses a **dark space/tech theme**. All new UI MUST follow these rules:

### CSS Classes (existing, use these)
- `.panel` — card container with dark glass background, border, blur
- `.reveal` / `.delay-1` / `.delay-2` / `.delay-3` — entrance animations
- `.step-badge.step-done` — green completed badge
- `.step-badge.step-not-started` — gray pending badge
- `.icon-button.icon-button-play` — small play action button (green hover)
- `.icon-button.icon-button-delete` — small delete button (red hover)
- `.icon-glyph` — icon glyph inside icon buttons
- `.cta` — primary action button (teal background)
- `.ghost` — secondary action button (transparent)
- `.eyebrow` — small uppercase label in teal
- `.subtitle` — muted subtitle text

### CSS Variables (always use these, never hardcode colors)
```css
var(--text)            /* #e6edf4 — main text */
var(--muted)           /* #a6b9c8 — muted/secondary text */
var(--highlight)       /* #2ec4b6 — teal accent */
var(--highlight-2)     /* #ff9f1c — amber accent */
var(--panel)           /* rgba(10,19,29,0.88) — panel background */
var(--panel-border)    /* rgba(151,177,205,0.28) — panel border */
var(--status-done)     /* #2ec4b6 */
var(--status-progress) /* #22c55e */
var(--status-ready)    /* #f59e0b */
var(--status-backlog)  /* #6b7280 */
```

### Forbidden Patterns
- ❌ Never use inline `style={{ backgroundColor: '...' }}` with hardcoded colors
- ❌ Never use light backgrounds (white, light gray) — this is a dark theme app
- ❌ Never use `useEffect` for data fetching — use TanStack Query
- ❌ Never add new custom CSS classes without checking if an existing class works

### Good Patterns
- ✅ Use existing `.step-badge` variants for status indicators
- ✅ Use `var(--muted)` for secondary text
- ✅ Use `var(--highlight)` for accent colors
- ✅ Use `border: 1px solid rgba(151, 177, 205, 0.22)` for subtle borders
- ✅ Use `background: rgba(2, 10, 16, 0.66)` for dark inner containers

## Code Style

- Named functions (not arrow function consts) for components
- `import type { ... }` for type-only imports
- `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()` — Biome enforces
- Magic numbers as named `const` at top of file
- No default exports

## Build & Quality

```bash
cd _bmad-custom/bmad-ui
npm run build    # TypeScript check + Vite build
```
