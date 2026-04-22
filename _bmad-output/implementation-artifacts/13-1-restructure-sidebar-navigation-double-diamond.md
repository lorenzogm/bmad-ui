# Story 13.1: Restructure Sidebar Navigation to Double Diamond Sections

Status: done

## Story

As a user,
I want the sidebar navigation to reflect the Double Diamond design framework,
so that I can navigate intuitively through Discover, Define, Develop, and Deliver phases.

## Acceptance Criteria

1. **Given** the app sidebar, **When** viewed, **Then** the navigation shows four Diamond sections (◇ Discover, ◇ Define, ◇ Develop, ◇ Deliver) plus 📚 Docs and 🤖 Agents links.

2. **Given** any route, **When** navigating to a Diamond section, **Then** the corresponding section header shows as active using `is-section-active` CSS class.

3. **Given** the Deliver section, **When** expanded, **Then** running sessions appear under Sessions and the Analytics submenu is nested within Deliver.

4. **Given** all existing routes, **When** navigating, **Then** all routes continue to work unchanged.

## Tasks / Subtasks

- [x] Remove `WORKFLOW_SUBMENU` constant from `__root.tsx`
- [x] Replace section active detection variables with Double Diamond logic
- [x] Restructure `<nav>` in `RootLayout` with Discover/Define/Develop/Deliver sections
- [x] Move Sessions and Analytics into Deliver submenu
- [x] Add 📚 Docs and 🤖 Agents section links
- [x] Verify `pnpm check` passes

## Dev Notes

- `isDiscoverSection`: path starts with `/workflow/analysis`
- `isDefineSection`: path starts with `/workflow/planning` or `/workflow/solutioning`
- `isDevelopSection`: path is `/` OR starts with `/workflow/implementation` OR `/epic.` OR `/story.`
- `isDeliverSection`: path starts with `/sessions`, `/session/`, or `/analytics`
