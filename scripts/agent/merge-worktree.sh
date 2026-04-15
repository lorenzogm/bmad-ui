#!/bin/bash

# merge-worktree.sh
# 
# Post-execution hook for BMAD agent workflows running in git worktrees.
# When an agent completes execution in a worktree (e.g., from VS Code UI),
# this script merges the generated artifacts back to the main workspace.
#
# Usage: merge-worktree.sh [--artifact <path>] [--push]
#   --artifact <path>   Path to artifact file relative to project root (e.g., _bmad-output/implementation-artifacts/sprint-status.yaml)
#   --push              Optionally push merged changes to remote origin
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ARTIFACT_PATH=""
SHOULD_PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --artifact)
      ARTIFACT_PATH="$2"
      shift 2
      ;;
    --push)
      SHOULD_PUSH=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to print colored output
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Detect if running in a git worktree
log_info "Detecting git worktree context..."

COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || echo "")

if [[ -z "$COMMON_DIR" ]]; then
  log_error "Failed to detect git common directory"
  exit 1
fi

# If --git-common-dir returns a path (not ".git"), we're in a worktree
if [[ "$COMMON_DIR" != ".git" ]]; then
  log_info "Running in git worktree: $COMMON_DIR"
  IS_WORKTREE=true
else
  log_info "Not running in a worktree (common dir is .git)"
  IS_WORKTREE=false
fi

# Step 2: If not in worktree, exit gracefully
if [[ "$IS_WORKTREE" == "false" ]]; then
  log_info "Skipping merge - running in main workspace"
  exit 0
fi

# Step 3: Determine main workspace root
# Find parent of .git-worktrees directory
WORKTREE_ROOT=$(pwd)
PROJECT_ROOT=""

while [[ "$WORKTREE_ROOT" != "/" ]]; do
  if [[ -d "$WORKTREE_ROOT/.git-worktrees" ]]; then
    PROJECT_ROOT=$(dirname "$WORKTREE_ROOT")
    break
  fi
  WORKTREE_ROOT=$(dirname "$WORKTREE_ROOT")
done

if [[ -z "$PROJECT_ROOT" ]]; then
  log_error "Could not determine project root - .git-worktrees not found in parent directories"
  exit 1
fi

log_info "Project root: $PROJECT_ROOT"

# Step 4: Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ -z "$CURRENT_BRANCH" ]]; then
  log_error "Could not determine current branch"
  exit 1
fi

log_info "Current worktree branch: $CURRENT_BRANCH"

# Step 5: Commit artifact changes if provided
if [[ -n "$ARTIFACT_PATH" ]]; then
  log_info "Committing artifact: $ARTIFACT_PATH"
  
  if git add "$ARTIFACT_PATH" 2>/dev/null; then
    if git diff-index --quiet --cached HEAD 2>/dev/null; then
      log_info "No changes to commit for $ARTIFACT_PATH"
    else
      if git commit -m "Generated $ARTIFACT_PATH from agent workflow" 2>/dev/null; then
        log_success "Committed artifact changes"
      else
        log_warn "Failed to commit changes - repository may have no changes"
      fi
    fi
  else
    log_error "Failed to add artifact: $ARTIFACT_PATH"
    exit 1
  fi
else
  log_info "No artifact specified - skipping commit"
fi

# Step 6: Merge worktree branch to main workspace
log_info "Merging worktree changes to main workspace..."

cd "$PROJECT_ROOT" || exit 1

# Check if main branch exists, fall back to master
MAIN_BRANCH="main"
if ! git rev-parse --verify "$MAIN_BRANCH" >/dev/null 2>&1; then
  MAIN_BRANCH="master"
fi

log_info "Target merge branch: $MAIN_BRANCH"

# Perform merge
if git merge "$CURRENT_BRANCH" --no-edit 2>/dev/null; then
  log_success "Successfully merged worktree changes to $MAIN_BRANCH"
else
  MERGE_STATUS=$?
  
  # Check if merge conflict exists
  if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
    log_error "Merge conflict detected"
    echo ""
    echo "Conflicted files:"
    git diff --name-only --diff-filter=U
    echo ""
    log_error "Please resolve conflicts in the main workspace and retry"
    
    # Abort the merge
    git merge --abort 2>/dev/null || true
    exit 1
  else
    log_error "Merge failed with exit code $MERGE_STATUS"
    exit $MERGE_STATUS
  fi
fi

# Step 7: Verify artifact exists in main workspace
if [[ -n "$ARTIFACT_PATH" ]]; then
  if [[ -f "$PROJECT_ROOT/$ARTIFACT_PATH" ]]; then
    log_success "Artifact verified in main workspace: $ARTIFACT_PATH"
  else
    log_error "Artifact not found in main workspace after merge: $ARTIFACT_PATH"
    exit 1
  fi
fi

# Step 8: Optional push to remote
if [[ "$SHOULD_PUSH" == "true" ]]; then
  log_info "Pushing merged changes to remote origin..."
  
  if git push origin "$MAIN_BRANCH" 2>/dev/null; then
    log_success "Successfully pushed to remote"
  else
    log_warn "Push to remote failed - changes are merged locally but not pushed"
    log_info "To push manually: cd $PROJECT_ROOT && git push origin $MAIN_BRANCH"
    # Don't exit with error - merge succeeded even if push failed
  fi
fi

log_success "Worktree merge workflow completed"
echo ""
echo "Merged changes from worktree ($CURRENT_BRANCH) to main workspace ($MAIN_BRANCH)"
if [[ -n "$ARTIFACT_PATH" ]]; then
  echo "Artifact location: $PROJECT_ROOT/$ARTIFACT_PATH"
fi
