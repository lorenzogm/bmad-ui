# GitHub Copilot Instructions

## Project Overview

BMAD UI — a UI for monitoring BMAD multi-agent workflows, sprint progress, and AI agent sessions. Built as a single-page React app inside a monorepo.

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

## BMAD Git Finalization Policy

For any BMAD workflow execution (create-story, dev-story, code-review, sprint planning/status, retrospectives, and any bmad-* skill):

1. If the workflow modified files, the agent must create a commit before ending the task.
2. The commit must include only files related to the workflow outcome (no unrelated files).
3. The agent must push the commit to `origin` before reporting completion.
4. If push fails, the agent must report the exact failure and keep the task in a non-complete state.
5. If there are no file changes, the agent must explicitly report "no changes to commit".

Required end-of-work checks:

- `git status --short`
- `git add -A` (or targeted add for scoped files)
- `git commit -m "<clear scoped message>"`
- `git push origin <current-branch>`

This policy is global and applies even when individual skill files do not explicitly mention git commit/push steps.

## App Verification with agent-browser

After making UI changes, verify the app works using [agent-browser](https://github.com/vercel-labs/agent-browser):

```bash
# 1. Start the dev server (if not already running)
cd _bmad-custom/bmad-ui && npm run dev &

# 2. Open the app and take a snapshot to check for errors
agent-browser open http://localhost:5173
agent-browser snapshot -i

# 3. Check for JavaScript errors
agent-browser errors

# 4. Navigate to key pages and verify rendering
agent-browser open http://localhost:5173/epics && agent-browser snapshot -i
agent-browser open http://localhost:5173/analytics && agent-browser snapshot -i

# 5. Close when done
agent-browser close
```

### What to check
- No JavaScript errors in `agent-browser errors`
- Home page shows "Overview" heading (not stuck on "Loading BMAD UI...")
- Sessions table renders with all sessions visible
- Navigation links (Home, Epics, Analytics) are present and functional

### Installation (one-time)
```bash
npm install -g agent-browser
agent-browser install   # Downloads Chrome for Testing
```

## Session Analytics Logging

Session tracking is **automated** via `_bmad-custom/agents/sync-sessions.mjs`, a background daemon that watches the Copilot debug logs (`~/Library/Application Support/Code - Insiders/User/workspaceStorage/…/GitHub.copilot-chat/debug-logs/*/main.jsonl`) and auto-upserts sessions into `_bmad-custom/agents/agents-sessions.json` every 5 seconds when active.

**You do not need to manually update `agents-sessions.json` for `turns`, `start_date`, `end_date`, or `status`** — the daemon derives these from the debug log timestamps.

### What the daemon auto-tracks
- `session_id` — from the debug log directory name
- `turns` — count of `session_start` entries in `main.jsonl`
- `start_date` — timestamp of the first entry
- `end_date` — timestamp of the last entry (when session has been inactive > 30 min)
- `status` — `"running"` if active within last 30 min, `"completed"` otherwise

### What you still update manually (when known)
**Required after every response:**
- Set `status: "completed"` and `end_date` to the current UTC timestamp — do this as the **last file edit before finishing your response**
- The sync daemon will reset `status` back to `"running"` and clear `end_date` when the user sends the next message (new turn detected)

Only update these fields if you have accurate data — do not guess:
- `model` — exact model ID (e.g. `claude-sonnet-4.6`)
- `premium_requests` — number of individual LLM API calls (if visible in session summary)
- `premium_cost_units` — `premium_requests × premium_multiplier`
- `agent` — skill name if a specific skill was invoked, else `"general"`
- `notes` — errors, retries, scope changes

### Schema reference

| Field | Description |
|---|---|
| `session_id` | Debug log directory name (auto) |
| `tool` | `"copilot-cli"` or `"vscode"` |
| `model` | Exact model ID (e.g. `claude-sonnet-4.6`, `claude-opus-4.5`, `gpt-4.1`) |
| `premium` | `true` for any non-base Copilot model |
| `premium_requests` | Number of individual LLM API calls |
| `premium_multiplier` | Cost weight: Haiku=0.25 · Sonnet=1 · Opus=3 · GPT-4.1=1 · GPT-5=2 |
| `premium_cost_units` | `premium_requests × premium_multiplier` |
| `tokens.input/output/total` | Token counts (0 if unavailable) |
| `agent` | Skill name or `"general"` |
| `turns` | Auto-derived from debug log |
| `status` | Auto-derived: `"running"` or `"completed"` |
| `start_date` | Auto-derived from debug log |
| `end_date` | Auto-derived from debug log |
| `notes` | Optional free text |

### Running the daemon
```bash
# Start (persistent, survives logout via launchd):
launchctl load ~/Library/LaunchAgents/com.bmad.sync-sessions.plist

# Stop:
launchctl unload ~/Library/LaunchAgents/com.bmad.sync-sessions.plist

# One-shot sync (from bmad-ui project):
npm run sync-sessions:once

# Watch logs:
tail -f /tmp/bmad-sync-sessions.log
```
