---
project_name: 'bmad-ui'
user_name: 'lorenzogm'
date: '2026-04-15'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'styling_rules', 'testing_rules', 'code_quality_rules', 'critical_rules']
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **React** 19.2.0
- **TypeScript** 5.9.2 (config extends `@repo/configs/typescript/react.json`)
- **Vite** 7.1.7
- **TanStack Router** 1.168.15 (manual route tree — NOT file-based auto-generation)
- **Tailwind CSS** 4.1.18 (Vite plugin — NOT PostCSS)
- **Vitest** 4.0.1 (configured with `--passWithNoTests`; no test files currently exist)
- **Biome** linter (NOT ESLint/Prettier)
- **ES Modules** — `"type": "module"` in package.json
- **Path alias** `@/*` → `./src/*`

## Language-Specific Rules

### TypeScript

- Extend `@repo/configs/typescript/react.json` — do not create a standalone `tsconfig.json`; use `"extends"` + override only `baseUrl` and `paths`
- Use `@/*` path alias for all imports from `src/` — never use relative `../../` traversals across feature boundaries
- Prefer `import type { ... }` for type-only imports (seen consistently throughout codebase)
- Use `Number.isNaN()` instead of `isNaN()` — Biome enforces this
- Use `Number.POSITIVE_INFINITY` instead of `Infinity`
- Use `Number.parseInt` / `Number.parseFloat` instead of global variants
- Magic numbers must be extracted to named `const` at the top of the file (e.g., `SECONDS_PER_MINUTE`, `GRAPH_LANE_SPACING`)
- Centralize shared types in `src/types.ts` — do not scatter type definitions across route files

### Imports

- Named imports only — no default export for React itself (React is in scope via JSX transform)
- `biome-ignore lint: <reason>` is the suppression comment format — not `eslint-disable`
- Module augmentation (`interface Register`) requires `// biome-ignore lint: Module augmentation requires interface syntax`

## Framework-Specific Rules

### React

- **`useEffect` is forbidden** — do not use it for data fetching, subscriptions, or side effects
- Use **TanStack Query** (`@tanstack/react-query`) for all data fetching and server state — `useQuery`, `useMutation`; never `fetch` directly in components
- No global state library unless state cannot be derived from server state; if needed, use **Zustand** (not Redux, Jotai, or Context API for global state)
- Components are defined as plain named functions (not arrow functions assigned to const) inside their route file
- `localStorage` key constants must be defined as named `const` strings (e.g., `SESSION_STATUS_FILTER_STORAGE_KEY`)

### TanStack Router

- Routes are **manually registered** in `src/routes/route-tree.ts` — there is NO auto-generation; every new route file must be imported and added to `routeTree`
- **Group related sub-routes in folders** (e.g., `routes/analytics/dashboard.tsx`, `routes/analytics/epics.tsx`)
- Each route file exports exactly one `createRoute(...)` constant (named `<name>Route`)
- Route file naming: `<segment>.tsx` for static, `<segment>.$param.tsx` for dynamic params
- Dynamic param access: `useParams({ from: "/<path>/$param" })` — always pass the `from` option
- Parent route is always `rootRoute` from `routes/__root` unless it is a layout child
- Route component is always the `component:` property — never use default exports for route components
- `createRootRoute` is used only in `__root.tsx`; all others use `createRoute`

## Styling Rules

### Tailwind CSS v4

- Tailwind is loaded via the **Vite plugin** (`@tailwindcss/vite`) — do NOT use PostCSS config or `tailwind.config.js`
- Source scanning is configured in `styles.css` with `@source "../src/**/*.{ts,tsx}"` — no additional config needed
- Tailwind v4 uses `@import "tailwindcss"` (not `@tailwind base/components/utilities` directives)
- **Use Tailwind utility classes exclusively** for all styling — do not define custom semantic class names or BEM-style classes
- Dark-themed design system — define color tokens as CSS custom properties on `:root` in `styles.css` and reference them via Tailwind (e.g., `bg-[var(--bg-top)]`)
- Typography: `Space Grotesk` (body) and `IBM Plex Mono` (monospace) — loaded from Google Fonts in `styles.css`
- Never generate Tailwind utility class strings dynamically (breaks static analysis/purging)

## Testing Rules

- Test runner: **Vitest** 4.0.1 — do not use Jest APIs
- No test files exist yet; `vitest run --passWithNoTests` is the CI command
- Test files should be co-located with source: `src/routes/epics.test.tsx`, `src/utils.test.ts`, etc.
- Use Vitest's built-in `describe`, `it`, `expect` — import from `"vitest"` explicitly
- For React component tests, use `@testing-library/react` (not Enzyme)
- Do not add snapshot tests — prefer explicit assertion-based tests
- Mock `fetch` and `EventSource` at the module boundary, not inline

## Code Quality & Build Rules

### Linter & Formatter

- **Biome** is the linter and formatter — do NOT add ESLint, Prettier, or `.eslintrc` files
- Lint suppression: `// biome-ignore lint/<rule>: <reason>` — always include a reason
- Use `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()`, `Number.POSITIVE_INFINITY` — Biome enforces the `no-globalIsNan` / `no-global-eval` family of rules

### Build

- Build command: `tsc --noEmit && vite build` — TypeScript must pass with zero errors before Vite bundles
- Type-check only: `tsc --noEmit` (alias `check:types`)
- Test only: `vitest run --passWithNoTests` (alias `check:tests`)
- Dev server: `vite` (alias `dev`)

### Code Organization

- Route-level page logic stays in `src/routes/` — shared/reusable logic goes in `src/` (e.g., `analytics-utils.tsx` exports shared hooks and components used across analytics routes)
- Shared types belong in `src/types.ts` — do not redeclare types that already exist there
- Named constants for every magic number and magic string — declare at the top of the file, before any functions
- No barrel `index.ts` files — import directly from the source file

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

- **Never use `useEffect`** — this is forbidden even for one-off side effects; use TanStack Query's `queryFn`, `onSuccess`/`onSettled`, or event handlers instead
- **Never add routes without registering them** in `src/routes/route-tree.ts` — the router will silently ignore unregistered routes
- **Never use relative deep imports** like `../../types` — always use the `@/*` alias
- **Never use global `isNaN`, `parseInt`, `parseFloat`, `Infinity`** — Biome will fail the lint check
- **Never add `tailwind.config.js` or `postcss.config.js`** — Tailwind v4 via Vite plugin needs neither
- **Never add ESLint or Prettier** — Biome is the single source of linting and formatting
- **Never scatter type definitions** across route files — add them to `src/types.ts`
- **Never use inline magic numbers** — every numeric/string constant must have a named `const`

### Dependency Management

- `@tanstack/react-query` is **not yet in `package.json`** — it must be added before using `useQuery`/`useMutation`
- `zustand` is **not yet in `package.json`** — add only if TanStack Query is insufficient for the use case
- The project uses a monorepo workspace (`workspace:*`) — shared configs come from `@repo/configs`
