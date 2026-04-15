---
storyId: '1-4'
storyTitle: 'Add Basic Contribution Guidance'
epicId: '1'
epicTitle: 'Open-Source Repository Governance & Publication'
status: 'review'
created: '2026-04-15'
priority: 'high'
---

# Story 1.4: Add Basic Contribution Guidance

## Story Statement

**As a** contributor,  
**I want** minimal contribution guidance available in the repository,  
**So that** I understand the basics of how to contribute without extensive documentation overhead.

---

## Acceptance Criteria

### README Contributing Section

- ✅ Repository root contains a README with a "Contributing" section
- ✅ The section covers how to open issues (describe the problem, steps to reproduce)
- ✅ The section covers how to submit PRs (fork, branch, commit, push, open PR)
- ✅ Section is concise (under 20 lines) and points to CONTRIBUTING.md for details

### CONTRIBUTING.md File

- ✅ `.github/CONTRIBUTING.md` exists in the repository
- ✅ File includes local setup reference (quick pointer to docs or commands)
- ✅ File specifies branch naming convention (e.g., `feature/`, `fix/`, `docs/`)
- ✅ File explains PR submission steps (link to main, no force-push, etc.)
- ✅ File is under 100 lines and focused on essential steps only
- ✅ File uses clear headings and formatting for easy scanning

### Content Quality

- ✅ Language is welcoming and inclusive (not intimidating to new contributors)
- ✅ No assumptions about deep project knowledge required
- ✅ Links to relevant documentation (setup, code style, etc.) where appropriate

---

## Developer Context

### Why This Story Matters

**Clear Contribution Pathways = Lower Barrier to Entry**

Contributing to open-source projects can be intimidating without clear guidance. By providing minimal but sufficient contribution documentation, we signal that the project welcomes contributions and make it easy for new developers to participate without reading extensive guides.

This story completes **Epic 1's "Open-Source Repository Governance"** by establishing contributor expectations at the repository level (FR5).

### Current State

From **Story 1.1 & 1.2**, the repository now has:
- ✅ Public visibility and metadata (description, topics, homepage)
- ✅ Branch protection rules on `main`
- ✅ Issue labels for triage
- ✅ GitHub Actions CI workflow

**What's missing:** Basic guidance for contributors on how to participate.

### Story Scope & Boundaries

**In Scope:**
- Add or update README "Contributing" section
- Create `.github/CONTRIBUTING.md` with essential contribution steps
- Branch naming conventions
- PR submission workflow
- Link to existing documentation (setup guides, code style)

**Out of Scope:**
- Detailed development environment setup (covered by Story 1.1 and epic docs)
- Advanced Git workflows (rebase, squash, etc.)
- Detailed code style enforcement (covered by Biome and TypeScript checks)
- Issue and PR templates (future story if needed)

### Contribution Guidance Best Practices

**Effective contribution docs:**
1. **Welcoming tone** — encourage participation, not gatekeep
2. **Clear steps** — concise, numbered instructions
3. **Link to existing resources** — don't duplicate; point to setup guides, code quality, testing docs
4. **Branch naming** — makes history readable and allows automation (e.g., CI, auto-linking PRs)
5. **PR expectations** — what reviewers look for, when PRs are ready for review

### Files to Create or Modify

| File | Action | Purpose |
|------|--------|---------|
| `README.md` | Update | Add "Contributing" section |
| `.github/CONTRIBUTING.md` | Create | Main contribution guide |

### Branch Naming Convention

From the project context and common practice, suggest:
- `feature/` prefix for new features (e.g., `feature/session-export`)
- `fix/` prefix for bug fixes (e.g., `fix/undefined-session-type`)
- `docs/` prefix for documentation updates (e.g., `docs/setup-guide`)
- `chore/` prefix for maintenance tasks (e.g., `chore/upgrade-deps`)

This allows automated PR workflows and clear history scanning.

---

## Previous Story Intelligence

### From Story 1.3 (Define Issue Labels for Triage)

- Standard labels are now available: `bug`, `enhancement`, `documentation`, `good-first-issue`, `help-wanted`, `question`, `wontfix`
- Use these labels in the contribution guide to show how contributors should label issues
- Good-first-issue label can be highlighted as a starting point for new contributors

### From Story 1.2 (Setup GitHub Infrastructure with Terraform)

- Branch protection is enforced on `main`: CI checks must pass
- Mention in the contribution guide that PRs must have passing checks before merge
- Repository settings are Terraform-managed (mention in code of conduct if applicable)

### From Story 1.1 (Reconcile Frontend Baseline)

- Repository already has CI workflows running (`pnpm run build`, `biome check`, etc.)
- Can reference these as the standard checks that PRs must pass
- Setup guide exists in the repository; link to it rather than duplicating

---

## Technical Requirements

### README Structure

Suggested structure for the README contribution section:

```
## Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues
- [Check existing issues](link) first
- Describe the problem and steps to reproduce
- Include your environment (OS, Node version, etc.)

### Submitting Pull Requests
1. Fork the repository
2. Create a branch from `main`: `git checkout -b feature/your-feature`
3. Make your changes and commit with clear messages
4. Push to your fork and open a PR against `main`
5. Ensure CI checks pass before requesting review

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed guidelines.
```

### CONTRIBUTING.md Structure

Suggested outline (must stay under 100 lines):

```markdown
# Contributing to bmad-ui

Thank you for your interest in contributing to bmad-ui!

## Getting Started
- [Setup Guide](../docs/LOCAL_SETUP.md) — local environment
- [Project Structure](../docs/project-overview.md) — codebase overview

## Development Workflow

### Branch Naming
- `feature/` — new features
- `fix/` — bug fixes
- `docs/` — documentation updates
- `chore/` — maintenance tasks

Example: `feature/add-session-export`

### Making Changes
1. Create a branch from `main`
2. Make your changes
3. Run tests and linting: `pnpm check`
4. Commit with clear messages

### Submitting a Pull Request
1. Push your branch to your fork
2. Open a PR against `main` with a clear title and description
3. Link related issues: "Closes #123"
4. Ensure CI checks pass
5. Address review feedback

## Code Quality
- Linting: Biome (auto-formatted on save in VS Code)
- Type checking: TypeScript (configured in tsconfig.json)
- Testing: Vitest (run with `pnpm test`)

See [Project Context](../docs/project-context.md) for detailed rules.

## Questions?
Open a discussion or GitHub issue with the `question` label.

Thanks for contributing! 🚀
```

---

## Key Deliverables

1. **Updated README.md**
   - Add "Contributing" section with links and concise instructions
   - Keep it brief; main content goes in CONTRIBUTING.md

2. **New .github/CONTRIBUTING.md**
   - Under 100 lines
   - Clear sections: setup, branch naming, workflow, code quality, help
   - Welcoming tone
   - Links to existing documentation

3. **Content Quality Checklist**
   - No jargon that assumes deep project knowledge
   - Links to existing guides (don't duplicate)
   - Branch naming examples included
   - Clear distinction between issues and PRs

---

## Definition of Done

✅ README.md has a "Contributing" section with basic issue/PR guidance  
✅ `.github/CONTRIBUTING.md` exists and is under 100 lines  
✅ Branch naming convention is documented  
✅ Links to existing setup and development guides are included  
✅ File has been reviewed for clarity and tone  
✅ Sprint status is updated to "done"  

---

## Implementation Notes

### Files Already Exist

The README.md likely already exists at the repository root. Check the current content and add a "Contributing" section if not present. Do not remove existing content.

### Directory Structure

Ensure `.github/` directory exists before creating `CONTRIBUTING.md`. The `.github/` directory is standard for GitHub-specific files (issue templates, workflows, etc.) and already exists in this repository.

### Tone & Accessibility

- Use "you" language — speak directly to the contributor
- Avoid technical jargon in the initial section; explain terms if needed
- Use positive language: "We welcome..." rather than "Don't..."
- Include examples (branch names, PR titles) to make it concrete

### References & Links

Update links in both files to point to real locations:
- `docs/LOCAL_SETUP.md` or equivalent setup documentation
- `docs/project-context.md` for code quality rules
- GitHub issue templates if they exist
- Code of Conduct if one will be added (not in this story scope)

---

## Validation & Testing

1. **Readability Check**
   - Open README.md and CONTRIBUTING.md in browser/editor
   - Verify links work and point to correct files
   - Check formatting and readability

2. **Tone & Accessibility**
   - Read as a new contributor — does it feel welcoming?
   - Are instructions clear without assuming deep knowledge?
   - Are examples concrete and helpful?

3. **Completeness Check**
   - Does README section cover issue reporting? ✓
   - Does README section cover PR submission? ✓
   - Does CONTRIBUTING.md cover branch naming? ✓
   - Does CONTRIBUTING.md cover PR workflow? ✓
   - Is everything under 100 lines in CONTRIBUTING.md? ✓

4. **Link Validation**
   - All links in both files should point to valid files/sections
   - Test relative paths from repository root
   - Verify GitHub markdown renders links correctly

---

## Success Criteria Summary

**A new contributor should be able to:**
1. Read README, find "Contributing" section
2. Understand the basic steps to report an issue or submit a PR
3. Click through to CONTRIBUTING.md for detailed guidance
4. Understand branch naming conventions
5. Know what checks they need to pass before PR is ready
6. Have links to setup and development guides

**Technical validation:**
- README.md has "Contributing" section
- `.github/CONTRIBUTING.md` is created and under 100 lines
- Links are valid and point to correct documentation
- Grammar and tone are professional and welcoming
- No broken markdown formatting

---

## Story Completion Checklist

- [x] README.md updated with "Contributing" section
- [x] `.github/CONTRIBUTING.md` created with all required sections
- [x] Branch naming convention documented with examples
- [x] Links validated and point to correct documentation
- [x] Content reviewed for tone, clarity, and completeness
- [x] Files committed to repository
- [x] Sprint status updated to "done" in sprint-status.yaml

---

## Next Steps

After this story is complete:
1. PR is ready for merge to `main`
2. **Epic 1 is complete** — all repository governance stories (1.1–1.4) are done
3. Optional: Epic 1 retrospective (1.1–1.4 learnings)
4. Next epic: **Epic 2 — Infrastructure Provisioning via Terraform**

---

## Related Resources

- [FR5 Requirement](../planning-artifacts/epics.md#story-14-add-basic-contribution-guidance) — Contributor can understand contribution expectations from repository-level guidance
- [Epic 1 Overview](../planning-artifacts/epics.md#epic-1-open-source-repository-governance--publication) — Open-Source Repository Governance & Publication
- [Project Context](../project-context.md#language-specific-rules) — Code quality and style rules
- [GitHub Guides: Contributing](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project) — Reference for best practices
