# API Contracts - bmad-ui

This document describes backend contracts as consumed by the dashboard frontend.

## Overview
- Contract style: REST + Server-Sent Events (SSE)
- Consumer: _bmad-custom/bmad-ui/src/routes/* and src/app.tsx
- Authentication: No explicit auth headers/tokens detected in client calls

## HTTP Endpoints

| Method | Path | Usage |
|---|---|---|
| GET | /api/overview | Dashboard/epics summary payload |
| GET | /api/epic/{epicId} | Epic detail payload |
| GET | /api/story/{storyId} | Story detail payload |
| GET | /api/session/{sessionId} | Session detail payload |
| GET | /api/analytics | Analytics payload |
| POST | /api/orchestrator/run | Start orchestrator run |
| POST | /api/orchestrator/stop | Stop orchestrator process |
| POST | /api/orchestrator/run-stage | Trigger single orchestrator stage |
| POST | /api/session/{sessionId}/start | Start specific session |
| POST | /api/session/{sessionId}/abort | Abort specific session |
| POST | /api/session/{sessionId}/input | Send chat/input payload to session |

## Streaming Endpoints (SSE)

| Method | Path | Usage |
|---|---|---|
| GET (SSE) | /api/events/overview | Live dashboard overview updates |
| GET (SSE) | /api/events/session/{sessionId} | Live session detail/log updates |

## Request/Response Notes
- Request bodies observed:
  - POST /api/session/{sessionId}/input: JSON body { message: string }
  - POST /api/orchestrator/run-stage: JSON payload inferred from app action invocation.
- Typical read responses are JSON objects mapped to TypeScript contracts in src/types.ts:
  - OverviewResponse
  - EpicDetailResponse
  - StoryDetailResponse
  - SessionDetailResponse
  - AnalyticsResponse

## Error Handling Patterns
- Client checks response.ok and surfaces status-based errors.
- Session start flow tolerates HTTP 409 conflict as a non-fatal outcome.

## Source Evidence
- _bmad-custom/bmad-ui/src/app.tsx
- _bmad-custom/bmad-ui/src/routes/epics.tsx
- _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx
- _bmad-custom/bmad-ui/src/routes/story.$storyId.tsx
- _bmad-custom/bmad-ui/src/routes/session.$sessionId.tsx
- _bmad-custom/bmad-ui/src/routes/analytics-utils.tsx
