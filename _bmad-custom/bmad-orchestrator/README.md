# BMAD Copilot Orchestrator

This script orchestrates BMAD skills in strict session boundaries with HITL checkpoints.

## Rules Enforced

- One fresh agent session per skill.
- `bmad-sprint-status` stage is intentionally disabled in this workflow.
- `bmad-create-story` defaults to `claude-opus-4.6`.
- `bmad-dev-story` defaults to `claude-sonnet-4.5`.
- `bmad-code-review` defaults to `claude-sonnet-4.5`.
- `bmad-sprint-status` defaults to `claude-sonnet-4.5`.
- Every launched session runs from its own git worktree.
- At the end of `bmad-dev-story`, the orchestrator prints a verification summary with concrete manual check steps.
- `create-story`, `dev-story`, and `code-review` can run in parallel whenever stories are eligible.
- A human review checkpoint is required after create-story before developing those created stories.
- No human checkpoint is required between `dev-story` and `code-review`.
- A final human review checkpoint is required before stories are marked as done.
- HITL prompts are required before each stage unless `--non-interactive` is used.

## BMAD Skill Chain

1. `bmad-create-story` (all eligible stories)
2. Human review checkpoint for created stories
3. `bmad-dev-story` (all eligible stories)
4. `bmad-code-review` (always in a separate agent session)
5. Human review checkpoint before marking done

## Runtime State

The script writes runtime telemetry to:

- `_bmad-custom/bmad-orchestrator/runtime-state.json`
- `_bmad-custom/bmad-orchestrator/logs/*.prompt.txt`
- `_bmad-custom/bmad-orchestrator/logs/*.log`

Session worktrees are created in `.git-worktrees/` at the repository root by default.
Set `BMAD_WORKTREES_DIR` to override this path (relative to repo root, or absolute).
If `.git-worktrees/` does not exist but `git-worktrees/` or `bmad-worktrees/` exists from older runs, the orchestrator keeps using the legacy folder automatically.

## Usage

Dry-run planning (default):

```bash
pnpm bmad:orchestrate
```

Execute commands with your agent CLI template:

```bash
BMAD_AGENT_COMMAND_TEMPLATE='copilot --model "{model}" --allow-all-tools --no-ask-user -p "$(cat {promptFile})"' \
  pnpm bmad:orchestrate -- --execute
```

Run non-interactive:

```bash
pnpm bmad:orchestrate -- --execute --non-interactive
```

Target a specific story:

```bash
pnpm bmad:orchestrate -- --story 2-5-pantalla-post-partido
```

## Custom Models

Override defaults:

```bash
pnpm bmad:orchestrate -- \
  --model-create-story claude-opus-4.6 \
  --model-dev-story claude-sonnet-4.5 \
  --model-code-review claude-sonnet-4.5 \
  --model-sprint-status claude-sonnet-4.5
```
