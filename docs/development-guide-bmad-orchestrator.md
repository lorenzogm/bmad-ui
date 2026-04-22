# Development Guide - bmad-orchestrator

## Prerequisites
- Node.js (current LTS recommended)
- Git (required for worktree-based orchestration behavior)

## Location
- Working directory: _bmad-ui/bmad-orchestrator

## Core Entry Point
- _bmad-ui/bmad-orchestrator/orchestrator.mjs

## Usage Patterns
From repository context, the orchestrator is invoked through command wrappers documented in README, for example:
```bash
pnpm bmad:orchestrate
pnpm bmad:orchestrate -- --execute --non-interactive
```

## Runtime Outputs
- _bmad-ui/bmad-orchestrator/runtime-state.json
- _bmad-ui/bmad-orchestrator/analytics.json
- _bmad-ui/bmad-orchestrator/logs/*.prompt.txt
- _bmad-ui/bmad-orchestrator/logs/*.log

## Development Notes
- Validate story dependency and session lifecycle behavior via runtime-state.json updates.
- Verify lock/worktree behavior before running parallel orchestration.
- Confirm generated logs match expected stage prompts and outcomes.

## Testing
- No dedicated automated test suite was detected for this part.
- Recommended manual checks:
  - Dry-run orchestration pipeline
  - Single-story target execution
  - Non-interactive execute mode
