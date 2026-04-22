# Story 9.5: Session Detail Back Navigation

Status: done

## Story

As a user reviewing a session,
I want a back navigation button on the session detail page,
so that I can return to the sessions list without using the browser back button.

## Acceptance Criteria

1. **Given** a user viewing `/session/:sessionId`, **When** they click the back button, **Then** they are navigated back to `/sessions`.

2. **Given** the back button is rendered, **When** viewed, **Then** it is visually consistent with the existing navigation patterns in the app (dark theme, CSS variables).

3. **Given** the session detail page, **When** a session ID is not found, **Then** the back button is still rendered so the user can recover.

## Tasks / Subtasks

- [x] Add back navigation to `src/routes/session.$sessionId.tsx` (AC: 1, 2)
  - [x] Import `Link` from TanStack Router
  - [x] Render a back link pointing to `/sessions` above the session content
  - [x] Style using `var(--muted)` for the muted arrow/label and `var(--highlight)` on hover, consistent with other detail pages

## Dev Notes

- Implemented within the same session as Stories 9.6 and 9.7 (Epic 9 polish sprint)
- No API changes required — purely a navigation addition
- Story file was omitted from the original same-commit (same-commit rule violation, flagged in Epic 9 retro)
- This story file created retroactively to close the sprint-status / story-file inconsistency (Epic 12 retro action item 2)

## Review

No separate code review was run for this story. Back navigation was a trivial one-commit UI addition with no logic changes.
