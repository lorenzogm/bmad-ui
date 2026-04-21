# Story 9.2: Navigation & Active Route Clarity

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the active navigation item to be clearly highlighted,
so that I always know which section of the app I'm in.

## Acceptance Criteria

1. **Given** any top-level route, **When** the user is on that page, **Then** the corresponding nav item is visually distinct using `var(--highlight)` or a background accent.

2. **Given** the navigation bar, **When** viewed on a narrow viewport (≤ 900px), **Then** nav items remain accessible and do not overflow or truncate illegibly.

3. **Given** navigating between routes, **When** the route changes, **Then** the active state updates immediately without a stale highlight on the previous item.

## Tasks / Subtasks

- [ ] Replace manual `aria-current` logic on sublinks with TanStack Router `activeProps` (AC: 1, 3)
  - [ ] Remove manual `aria-current={currentPath === linkPath ? "page" : undefined}` from workflow phase sublinks and analytics sublinks in `__root.tsx`
  - [ ] Add `activeProps={{ 'aria-current': 'page' as const }}` to these `<Link>` components so TanStack Router drives the active attribute natively
  - [ ] Add `activeOptions={{ exact: false }}` to workflow phase sublinks (`/workflow/$phaseId`) so deep nested routes like `/workflow/planning/prd-detail` keep "Planning" highlighted
  - [ ] Analytics sublinks already have `activeOptions={{ exact: true }}` for the Overview item — verify the others do not need `exact: true`
  - [ ] Keep manual `aria-current` on session detail sublinks (`/session/$sessionId`) — those are dynamic and the comparison is correct

- [ ] Fix section-header active styling (AC: 1)
  - [ ] Remove `aria-current` from the Workflow, Sessions, and Analytics section header `<Link>` elements — the `is-section-active` CSS class (color teal, full opacity) is the intended indicator for section headers; `[aria-current="page"]` triggers a `border-left + background` style that is wrong for uppercase label headings
  - [ ] Keep the `is-section-active` class logic (already derived from `useLocation()` which is reactive)
  - [ ] Verify `.sidebar-link-section:hover` and `.sidebar-link.is-section-active` produce the intended visual in both active and inactive states

- [ ] Fix the Home link active state (AC: 1, 3)
  - [ ] The sidebar brand `<Link to="/">` has no active indicator; it is navigable but visually silent — this is acceptable (brand logo convention), no change needed unless the "Home" route (`/`) needs a nav entry
  - [ ] Confirm the home route does not appear in the sidebar nav list; if it should, add it as the first `sidebar-link` with correct `activeOptions={{ exact: true }}`

- [ ] Narrow viewport nav accessibility (AC: 2)
  - [ ] The current responsive CSS at `@media (max-width: 900px)` shrinks the sidebar to 200px but nav label text is not protected from overflow
  - [ ] Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to `.sidebar-sublink` in `styles.css` for the 200px state (put inside the existing `@media (max-width: 900px)` block)
  - [ ] Verify section-header labels (Workflow, Sessions, Analytics) also do not overflow at 200px — they are uppercase short strings so they should be fine; confirm and add `overflow: hidden` if needed
  - [ ] Do NOT add a hamburger/collapsible menu (out of scope for this story)

- [ ] Verify and quality gate (AC: 1, 2, 3)
  - [ ] Manually navigate through Workflow > Planning > [step detail], Sessions, Analytics in the dev server and confirm active state highlights update correctly at each step
  - [ ] Resize browser to ~800px and confirm nav items are readable without horizontal overflow
  - [ ] Run `cd _bmad-custom/bmad-ui && pnpm check` — must pass with zero errors

## Dev Notes

### File to Edit

Only one source file needs changes:
- `_bmad-custom/bmad-ui/src/routes/__root.tsx` — all navigation logic lives here
- `_bmad-custom/bmad-ui/src/styles.css` — narrow viewport overflow fix only

No new files. No new routes. No changes to `route-tree.ts`.

### Current Navigation Pattern (What to Change)

**Workflow phase sublinks (current — broken for nested routes):**

```tsx
<Link
  aria-current={currentPath === linkPath ? "page" : undefined}  // ← manual, misses nested routes
  className="sidebar-sublink"
  key={link.label}
  params={{ phaseId: link.phaseId }}
  to="/workflow/$phaseId"
>
```

**Target pattern:**

```tsx
<Link
  activeOptions={{ exact: false }}   // ← match /workflow/planning AND /workflow/planning/prd-detail
  activeProps={{ 'aria-current': 'page' as const }}
  className="sidebar-sublink"
  key={link.label}
  params={{ phaseId: link.phaseId }}
  to="/workflow/$phaseId"
>
```

**Workflow "Overview" sublink (current — already has `activeOptions={{ exact: true }}`):**

```tsx
<Link
  activeOptions={{ exact: true }}   // ← keep; /workflow must not match /workflow/planning
  aria-current={currentPath === linkPath ? "page" : undefined}  // ← replace with activeProps
  className="sidebar-sublink"
  key={link.label}
  to="/workflow"
>
```

**Target:**

```tsx
<Link
  activeOptions={{ exact: true }}
  activeProps={{ 'aria-current': 'page' as const }}
  className="sidebar-sublink"
  key={link.label}
  to="/workflow"
>
```

**Analytics sublinks (same migration pattern):**

```tsx
<Link
  activeOptions={link.to === "/analytics" ? { exact: true } : undefined}
  activeProps={{ 'aria-current': 'page' as const }}
  className="sidebar-sublink"
  key={link.to}
  to={link.to}
>
```
Remove the manual `aria-current` prop entirely.

**Section headers (Workflow, Sessions, Analytics — remove `aria-current`):**

```tsx
// Before
<Link
  aria-current={currentPath.startsWith("/workflow") ? "page" : undefined}  // ← causes wrong border-left style
  className={`sidebar-link sidebar-link-section ${isWorkflowSection ? "is-section-active" : ""}`}
  to="/workflow"
>

// After — drop aria-current, keep is-section-active
<Link
  className={`sidebar-link sidebar-link-section ${isWorkflowSection ? "is-section-active" : ""}`}
  to="/workflow"
>
```

Apply the same fix to Sessions and Analytics section headers.

### CSS Change (Narrow Viewport)

Inside the existing `@media (max-width: 900px)` block in `styles.css`, add:

```css
.sidebar-sublink {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Do not add a new media query block.

### Why `activeProps` Over Manual Comparison

TanStack Router's `<Link>` component tracks active state reactively based on the router's own location store. Using `activeProps` means:
- Active state is derived from the same source as route transitions → zero stale highlight risk (AC 3)
- `exact: false` naturally handles child routes without any string operations (AC 1 for nested)
- No need to keep `currentPath` variable or manual `===` comparisons for these links

The `currentPath` variable and `useLocation()` call are still needed for the `isWorkflowSection`, `isSessionsSection`, `isAnalyticsSection` boolean flags (used by `.is-section-active` class). Keep those.

### Active CSS Already Correct

The existing CSS selectors already produce the right visual for AC 1:

```css
.sidebar-sublink[aria-current="page"] {
  color: var(--highlight);
  font-weight: 700;
  border-left-color: var(--highlight);
  background: rgba(46, 196, 182, 0.08);
}

.sidebar-link.is-section-active {
  color: var(--highlight);
  opacity: 1;
}
```

No CSS changes needed for the active visual itself — only the `overflow` fix for AC 2.

### Session Sublinks — Keep Manual Comparison

Dynamic session links use:

```tsx
<Link
  aria-current={currentPath === linkPath ? "page" : undefined}
  className={`sidebar-sublink${isRunning ? " session-link-running" : ""}`}
  ...
  to="/session/$sessionId"
>
```

These are correct as-is because `linkPath` is built from `session.sessionId` which matches the exact dynamic param. No change needed.

### TanStack Router Version

TanStack Router `1.168.22` — `activeProps` and `activeOptions` are stable APIs in this version. No version upgrade needed.

### References

- Nav markup: [`_bmad-custom/bmad-ui/src/routes/__root.tsx`] lines 260–360
- Nav CSS: [`_bmad-custom/bmad-ui/src/styles.css`] `.sidebar-sublink[aria-current="page"]` at line 179; `@media (max-width: 900px)` at line 2044
- Responsive sidebar CSS: line 2044 block
- Epic 9 scope: [`_bmad-output/planning-artifacts/epics.md`] Story 9.2 (line 1072)
- Project context: [`_bmad-output/project-context.md`] TanStack Router rules, Styling rules

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
