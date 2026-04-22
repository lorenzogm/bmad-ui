# Data Models - bmad-ui

## Summary
No database migrations, ORM schemas, or persistent relational model files were detected in _bmad-ui. Data contracts are defined as TypeScript types and consumed from backend APIs.

## Contract Model Source
- Primary file: _bmad-ui/src/types.ts

## Key Domain Entities (TypeScript)
- RuntimeSession
- RuntimeState
- OverviewResponse
- StoryDetailResponse
- EpicDetailResponse
- SessionDetailResponse
- AnalyticsResponse
- TokenUsage, SessionAnalytics, StoryAnalytics, EpicAnalytics

## Persistence Characteristics
- Frontend appears stateless beyond in-memory React state.
- Durable runtime/analytics data is produced by orchestrator-side JSON files, not by a direct client-side database layer.

## Schema/Migration Scan Results
- Prisma files: none
- SQL migration files: none
- ORM model directories: none

## Implication
For brownfield planning, treat this part as a typed API client with contract-based models rather than a schema-owning data service.
