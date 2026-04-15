# Component Inventory - bmad-ui

## Inventory Scope
Scanned _bmad-custom/bmad-ui/src for route components, dashboard sections, and reusable UI patterns.

## Route Components
- __root.tsx: root route container.
- index.tsx: landing/dashboard route.
- epics.tsx: epics overview route.
- epic.$epicId.tsx: epic detail route.
- story.$storyId.tsx: story detail route.
- session.$sessionId.tsx: session detail route with command input/actions.
- analytics.tsx and analytics-*.tsx: analytics dashboards and detail views.

## Dashboard/Feature Components (within app.tsx and route modules)
- EpicTableSection (epic list/table rendering)
- Story dependency graph sections (visualized flow/state helpers)
- Session action controls (start/abort/action states)
- Table-based status views for stories, sessions, and analytics

## UI Categories
- Navigation: top-level route links and detail navigation links.
- Data display: tables, badges, status pills, summary cards.
- Actions: orchestrator run/stop/stage controls, session start/abort/input.
- Feedback: loading screens, error banners, runtime status labels.

## Design System Signals
- Styling consolidated via src/styles.css.
- Class-driven utility naming indicates a custom style layer, not a third-party component library.

## Reusability Notes
- Reusable behavior mostly implemented through helper functions and typed models.
- Reusable visual primitives are inferred from class naming conventions rather than a dedicated components/ library folder.
