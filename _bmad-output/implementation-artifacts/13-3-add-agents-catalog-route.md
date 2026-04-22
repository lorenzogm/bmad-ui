# Story 13.3: Add Agents Catalog Route (`/agents`)

Status: done

## Story

As a user,
I want a dedicated Agents page at `/agents`,
so that I can discover and understand the BMAD agent catalog.

## Acceptance Criteria

1. **Given** navigating to `/agents`, **When** the page loads, **Then** a card grid shows all BMAD agents.

2. **Given** an agent card, **When** viewed, **Then** it shows the agent's icon, name, title, role, and description.

3. **Given** the sidebar, **When** on `/agents`, **Then** the 🤖 Agents link shows as active.

## Tasks / Subtasks

- [x] Create `_bmad-ui/src/routes/agents.tsx` with `AgentsPage` component and `agentsRoute`
- [x] Define `AGENT_CATALOG` constant with 6 BMAD agents (Mary, Paige, John, Sally, Winston, Amelia)
- [x] Implement `AgentCard` component using `.panel` class and CSS variables
- [x] Register `agentsRoute` in `route-tree.ts`
- [x] Verify `pnpm check` passes

## Dev Notes

- Static catalog — no backend API; data embedded in the component file
- Each card renders: icon (large), name + title (teal accent), role (italic muted), description, agent id (small muted footer)
