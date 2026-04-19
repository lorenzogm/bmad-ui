---
project_name: 'bmad-ui'
user_name: 'lorenzogm'
date: '2026-04-19'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'styling_rules', 'testing_rules', 'code_quality_rules', 'critical_rules']
status: 'complete'
rule_count: 68
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **React** 19.2.5
- **TypeScript** 6.0.2 (strict, standalone `tsconfig.json` — no workspace extends)
- **Vite** 8.0.8
- **TanStack Router** 1.168.22 (manual route tree — NOT file-based auto-generation)
- **TanStack React Query** 5.99.0 (+ devtools 5.99.0)
- **ECharts** 6.0.0 (analytics visualizations)
- **marked** 18.0.0 (markdown rendering)
- **Tailwind CSS** 4.2.2 (Vite plugin — NOT PostCSS)
- **Vitest** 4.1.4 (configured with `--passWithNoTests`)
- **Biome** 2.4.12 (NOT ESLint/Prettier)
- **Node.js** ≥ 24, **pnpm** ≥ 10
- **ES Modules** — `"type": "module"` in package.json
- **Path alias** `@/*` → `./src/*`
- **Deployment**: Vercel (static build with API rewrites)

## Language-Specific Rules

### TypeScript

- Standalone `tsconfig.json` with `"strict": true` — NOT extending a workspace config
- Use `@/*` path alias for all imports from `src/` — never use relative `../../` traversals across feature boundaries
- Prefer `import type { ... }` for type-only imports — Biome enforces `useImportType`
- Use `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()`, `Number.POSITIVE_INFINITY` — Biome enforces `useNumberNamespace`
- Magic numbers must be extracted to named `const` at the top of the file (e.g., `SECONDS_PER_MINUTE`, `CHART_COLOR_01`)
- Colocate types with their consumers — no global `types.ts` file
- `noUnusedLocals` and `noUnusedParameters` are enabled — all variables and params must be used

### Imports

- Named imports only — no default exports for React (JSX transform handles it)
- Biome suppression comment: `// biome-ignore lint/<rule>: <reason>` — always include a reason
- Module augmentation (`interface Register`) requires `// biome-ignore lint: Module augmentation requires interface syntax`

## Framework-Specific Rules

### React

- Components are defined as **named functions** (not arrow functions assigned to const)
- **`useEffect` is allowed ONLY for:** SSE/EventSource streams, DOM scroll effects, localStorage sync, and ECharts lifecycle — **NEVER for data fetching**
- Use **TanStack Query** (`useQuery`, `useMutation`) for all data fetching and server state
- No global state library unless state cannot be derived from server state
- `localStorage` key constants must be defined as named `const` strings

### TanStack Router

- Routes are **manually registered** in `src/routes/route-tree.ts` — NO auto-generation
- Each route file exports exactly one `createRoute(...)` constant (named `<name>Route`)
- Route file naming: `<segment>.tsx` for static, `<segment>.$param.tsx` for dynamic params
- Dynamic param access: `useParams({ from: "/<path>/$param" })` — always pass the `from` option
- Parent route is `rootRoute` unless it is a layout child (e.g., workflow, analytics layouts)
- Layout routes use `Outlet` and `.addChildren([...])` in `route-tree.ts`
- `createRootRoute` is used only in `__root.tsx`; all others use `createRoute`

### Dual-Mode Architecture

- `src/lib/mode.ts` exports `IS_LOCAL_MODE` (true in dev) and `apiUrl()` helper
- In **dev**: API calls go to Vite dev server middleware (`scripts/agent-server.ts`)
- In **production**: API calls resolve to static JSON under `/data/*.json` (pre-built by `vite-plugin-static-data.ts`)
- Action features (run skill, send input, abort) are gated behind `IS_LOCAL_MODE`
- Always use `apiUrl("/api/...")` for fetch URLs — never hardcode paths

## Styling Rules

### Core Principle

- Use **shadcn/ui** (with **Base UI** as the headless primitive layer) for all UI components
- **No custom CSS classes** — shared visual patterns live in React components, not CSS classes
- Use **Tailwind utility classes** directly on JSX elements for all styling
- Existing custom CSS classes in `styles.css` are legacy — do not add new ones

### Component Architecture

- Install shadcn components via CLI and customize with Tailwind + CSS variables
- Base UI provides accessible, unstyled headless primitives (dialogs, menus, popovers, etc.)
- All reusable UI components go in `src/ui/components/` following the atomic hierarchy
- Page-specific compositions stay in page files; shared building blocks go in `ui/components/`

### Theme & Design System

- Dark space/tech theme — **never use light backgrounds**
- CSS custom properties on `:root` in `styles.css` — reference via Tailwind bracket syntax (e.g., `bg-[var(--panel)]`, `text-[var(--muted)]`)
- Typography: `Space Grotesk` (body), `IBM Plex Mono` (monospace) — Google Fonts
- Never generate Tailwind class strings dynamically (breaks static analysis)

### Tailwind CSS v4

- Loaded via **Vite plugin** (`@tailwindcss/vite`) — no PostCSS or `tailwind.config.js`
- Source scanning: `@source "../src/**/*.{ts,tsx}"` in `styles.css`
- Uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- Biome CSS linter enabled with `tailwindDirectives: true`

### CSS Variables (never hardcode colors)

`var(--text)`, `var(--muted)`, `var(--highlight)`, `var(--highlight-2)`, `var(--panel)`, `var(--panel-border)`, `var(--bg-top)`, `var(--bg-bottom)`, `var(--status-done)`, `var(--status-progress)`, `var(--status-ready)`, `var(--status-review)`, `var(--status-backlog)`

## Testing Rules

- Test runner: **Vitest** 4.1.4 — do not use Jest APIs
- No test files exist yet; `vitest run --passWithNoTests` is the CI command
- Test files should be co-located with source: `src/ui/pages/home.test.tsx`, `src/utils/format-date.test.ts`
- Use Vitest's built-in `describe`, `it`, `expect` — import from `"vitest"` explicitly
- For React component tests, use `@testing-library/react` (not Enzyme)
- Do not add snapshot tests — prefer explicit assertion-based tests
- Mock `fetch` and `EventSource` at the module boundary, not inline

## Code Quality & Build Rules

### Linter & Formatter

- **Biome** 2.4.12 is the linter and formatter — do NOT add ESLint, Prettier, or their configs
- Lint suppression: `// biome-ignore lint/<rule>: <reason>` — always include a reason
- Key enforced rules: `useNumberNamespace`, `useImportType`, `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`, `useIsNan`
- Formatter: 2-space indent, 100-char line width, double quotes, trailing commas (ES5), no semicolons
- Biome CSS linter enabled with Tailwind directive support

### Build

- Quality gate: `pnpm check` → lint + types + tests + build (run before every commit)
- Build: `tsc --noEmit && vite build` — TypeScript must pass with zero errors before bundling
- Type-check only: `tsc --noEmit` (alias `check:types`)
- Test only: `vitest run --passWithNoTests` (alias `check:tests`)
- Dev server: `vite` (alias `dev`)

### Code Organization

- **Component hierarchy** (shadcn + Base UI):
  - `src/ui/components/elements/` — basic atoms (Button, Badge, Input)
  - `src/ui/components/patterns/` — combinations of elements (DataTable, StatCard)
  - `src/ui/components/blocks/` — page sections (HeroPanel, SessionsTable)
- **Pages**: `src/ui/pages/` — top-level page components
- **Routes**: `src/routes/` — route definitions that reference pages
- **Utils**: `src/utils/` — one function per file, one export per file (e.g., `format-date.ts`, `parse-story-ticket.ts`)
- **Types**: colocate types with their consumers — no global `types.ts` file
- **Lib**: `src/lib/` for cross-cutting concerns (e.g., `mode.ts`)
- Named constants for every magic number and string — declare at top of file
- No barrel `index.ts` files — import directly from the source file

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

- **Never use `useEffect` for data fetching** — use TanStack Query (`useQuery`/`useMutation`); `useEffect` is only acceptable for SSE streams, DOM scroll, localStorage sync, and chart lifecycle
- **Never add routes without registering them** in `src/routes/route-tree.ts` — the router silently ignores unregistered routes
- **Never use global `isNaN`, `parseInt`, `parseFloat`, `Infinity`** — Biome will fail
- **Never add `tailwind.config.js` or `postcss.config.js`** — Tailwind v4 via Vite plugin needs neither
- **Never add ESLint or Prettier** — Biome is the single linter/formatter
- **Never add custom CSS classes** — extract shared visuals into components
- **Never create barrel `index.ts` files** — Biome enforces `noBarrelFile`
- **Never put types in a global file** — colocate with consumers
- **Never export multiple functions from a util file** — one function, one file
- **Never use inline magic numbers** — every constant must have a named `const`
- **Never use inline `style={{}}` with hardcoded colors** — use CSS variables via Tailwind
- **Never use relative deep imports** like `../../types` — use the `@/*` alias

### Production vs Local

- Always gate action features (run skill, abort, send input) behind `IS_LOCAL_MODE`
- Always use `apiUrl()` from `src/lib/mode.ts` for fetch URLs — never hardcode `/api/` paths
- Static JSON data is pre-built at build time by `vite-plugin-static-data.ts` — production has no live API

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-19
