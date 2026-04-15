# Agent Scripts

Scripts for integrating BMAD agent workflows with the bmad-ui project infrastructure.

## merge-worktree.sh

Post-execution hook for BMAD agent workflows running in git worktrees.

### Purpose

When an agent runs from the VS Code UI, it executes in a git worktree context. Generated artifacts (like `sprint-status.yaml` from the sprint planning workflow) are created in the worktree but need to be merged back to the main workspace where the bmad-ui project operates.

This script automates that merge workflow.

### Usage

```bash
# Basic usage - detect and merge only
./merge-worktree.sh

# Merge a specific artifact
./merge-worktree.sh --artifact _bmad-output/implementation-artifacts/sprint-status.yaml

# Merge and push to remote
./merge-worktree.sh --artifact _bmad-output/implementation-artifacts/sprint-status.yaml --push
```

### Options

- `--artifact <path>`: Path to artifact file relative to project root. If provided, commits the artifact before merging.
- `--push`: After successful merge, push changes to remote origin.

### How It Works

1. **Detect Context**: Checks if running in a git worktree using `git rev-parse --git-common-dir`
2. **Skip if Not in Worktree**: If running in main workspace, exits gracefully
3. **Find Main Workspace**: Locates parent project root by finding `.git-worktrees` directory
4. **Commit Artifact** (if specified): Stages and commits the artifact file
5. **Merge Branches**: Merges current worktree branch into main branch (main or master)
6. **Verify**: Confirms artifact exists in main workspace post-merge
7. **Push** (if requested): Optionally pushes to remote origin

### Error Handling

- **Merge Conflicts**: Detects conflicts, reports conflicted files, aborts merge, and instructs user to resolve manually in main workspace
- **Push Failures**: Reports that changes merged locally but remote push failed (non-blocking)
- **Missing Artifact**: Verifies artifact exists in main workspace after merge

### Integration with Sprint Planning

After sprint planning runs, call this script to merge the generated `sprint-status.yaml`:

```bash
./scripts/agent/merge-worktree.sh \
  --artifact _bmad-output/implementation-artifacts/sprint-status.yaml \
  --push
```

### Exit Codes

- `0`: Success
- `1`: Error (worktree detection failure, merge conflict, artifact not found, or push failure)

### Example Output

```
[INFO] Detecting git worktree context...
[INFO] Running in git worktree: /path/to/.git/worktrees/workflow-bmad-sprint-planning-1776265920497
[INFO] Project root: /Users/lorenzogm/lorenzogm/bmad-ui
[INFO] Current worktree branch: 5c535b9 (detached HEAD)
[INFO] Committing artifact: _bmad-output/implementation-artifacts/sprint-status.yaml
[SUCCESS] Committed artifact changes
[INFO] Merging worktree changes to main workspace...
[INFO] Target merge branch: main
[SUCCESS] Successfully merged worktree changes to main
[SUCCESS] Artifact verified in main workspace: _bmad-output/implementation-artifacts/sprint-status.yaml
[SUCCESS] Worktree merge workflow completed

Merged changes from worktree (5c535b9) to main workspace (main)
Artifact location: /Users/lorenzogm/lorenzogm/bmad-ui/_bmad-output/implementation-artifacts/sprint-status.yaml
```
