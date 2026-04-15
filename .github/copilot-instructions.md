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

## Session Analytics Logging

**Every agent session — whether run from VS Code or the Copilot CLI — must be logged to `_bmad-custom/agent-sessions.json`.**

### When to update

- **Start of session**: create an entry with `status: "running"`, `end_date: null`
- **After each agent response**: set `status: "completed"`, increment `turns`, `premium_requests`, `premium_cost_units`, and token counts
- **When the user sends a new message**: immediately set `status: "running"` before processing
- **End of session**: set `end_date` to the current UTC timestamp

### Schema

```json
{
  "session_id": "<session id if available>",
  "tool": "copilot-cli",
  "model": "claude-sonnet-4.6",
  "premium": true,
  "premium_requests": 4,
  "premium_multiplier": 1,
  "premium_cost_units": 4,
  "tokens": {
    "input": 12000,
    "output": 3000,
    "total": 15000
  },
  "agent": "general",
  "turns": 4,
  "status": "running",
  "start_date": "2026-04-15T13:20:52Z",
  "end_date": null,
  "notes": ""
}
```

### Field reference

| Field | Description |
|---|---|
| `session_id` | Copilot CLI session ID if available; omit otherwise |
| `tool` | `"copilot-cli"` or `"vscode"` |
| `model` | Exact model ID (e.g. `claude-sonnet-4.6`, `claude-opus-4.5`, `gpt-4.1`) |
| `premium` | `true` for any non-base Copilot model |
| `premium_requests` | Number of individual LLM API calls made so far |
| `premium_multiplier` | Cost weight: Haiku=0.25 · Sonnet=1 · Opus=3 · GPT-4.1=1 · GPT-5=2 |
| `premium_cost_units` | `premium_requests × premium_multiplier` |
| `tokens.input` | Total input/prompt tokens consumed |
| `tokens.output` | Total output/completion tokens generated |
| `tokens.total` | `input + output` |
| `agent` | Skill name if invoked (e.g. `bmad-create-prd`), otherwise `"general"` |
| `turns` | Number of user↔agent exchanges so far |
| `status` | `"running"` while agent is processing · `"completed"` once done (set back to `"running"` when user sends next message) |
| `start_date` | ISO 8601 UTC timestamp when the session started |
| `end_date` | ISO 8601 UTC timestamp when the session ended, or `null` if still active |
| `notes` | Optional: errors, retries, scope changes |

### Rules
- Omit `session_id` key entirely if not available.
- When running in the terminal (Copilot CLI), read token usage from the session summary when available. Otherwise set to `0`.
- If multiple agents/skills were used in one session, log the primary one and mention others in `notes`.
