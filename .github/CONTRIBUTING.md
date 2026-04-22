# Contributing to bmad-ui

Thank you for your interest in contributing to bmad-ui! We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

## Getting Started

- [Development Guide](../docs/development-guide-bmad-ui.md) — local setup and dev workflow
- [Project Overview](../docs/project-overview.md) — codebase structure and architecture
- [Secrets Workflow](../docs/secrets-workflow.md) — encrypted secrets and dotenvx setup

### Local Setup

```bash
# Move to the app workspace
cd _bmad-ui

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run quality checks
pnpm run check
```

## Development Workflow

### Branch Naming

Use a consistent prefix so history stays readable and CI automation works correctly:

| Prefix | Use for |
|--------|---------|
| `feature/` | New features (e.g., `feature/session-export`) |
| `fix/` | Bug fixes (e.g., `fix/undefined-session-type`) |
| `docs/` | Documentation updates (e.g., `docs/setup-guide`) |
| `chore/` | Maintenance tasks (e.g., `chore/upgrade-deps`) |

Always branch from `main`: `git checkout -b feature/your-feature`

### Making Changes

1. Create a branch from `main`
2. Make focused, well-scoped changes
3. Run all checks before committing:
   ```bash
   cd _bmad-ui
   pnpm run check   # lint + types + tests + build
   ```
4. Commit with clear, descriptive messages

### Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `main` with a clear title and description
3. Link related issues: `Closes #123`
4. Ensure all CI checks pass (TypeScript, Biome lint, build, tests)
5. Address any review feedback promptly
6. Do not force-push after a review has started

## Documentation Contributions

Documentation improvements are the fastest path to improving the contributor experience. If you notice an error, gap, or unclear step in any doc, please fix it.

### What Counts as a Docs-Only Change

A docs-only PR modifies only:
- `README.md`
- `docs/**/*.md`
- `.github/CONTRIBUTING.md`
- `.github/*.md` (other markdown in `.github/`)

No source code, config, or workflow files should be changed in a docs-only PR.

### How to Submit a Docs Improvement

1. Fork the repository and create a branch: `git checkout -b docs/fix-setup-steps`
2. Edit the relevant file(s) in `docs/` or `README.md`
3. Open a PR against `main` with the title prefix `docs:` (e.g., `docs: fix pnpm install step`)
4. Mark **Documentation update** in the PR Type of Change checklist
5. Mark the Testing section as **N/A** — no test runs required for docs-only PRs

### Review Criteria for Docs PRs

Docs PRs are reviewed for:
- **Accuracy**: Commands, paths, and steps are correct
- **Clarity**: Instructions are unambiguous for the target audience
- **Link validity**: All internal links resolve to real sections or files
- **Spelling/grammar**: No obvious errors

No Biome lint, TypeScript, or build checks are required for docs-only changes.

### Pointing Contributors to This Process

Maintainers can use this one-liner when directing contributors:

> See [Documentation Contributions](.github/CONTRIBUTING.md#documentation-contributions) in the contributing guide for how to submit a docs improvement.

## Code Quality

| Tool | Command | Purpose |
|------|---------|---------|
| **Biome** | `biome check src/` | Linting + formatting |
| **TypeScript** | `pnpm run check:types` | Type checking |
| **Vitest** | `pnpm run check:tests` | Unit tests |
| **Vite** | `pnpm run build` | Production build check |

See [Project Context](../_bmad-output/project-context.md) for detailed coding rules and patterns.

## Secrets & Credentials

**Good news: frontend development requires no secrets.**

The following commands work immediately after `pnpm install` — no environment variables needed:

```bash
cd _bmad-ui
pnpm dev           # Start dev server
pnpm run check     # Lint + typecheck + tests + build
pnpm run build     # Production build
```

### What Requires Production Secrets

The following workflows require credentials held only by maintainers:

| Task | Command / Tool | Who Can Run |
|------|---------------|-------------|
| Deploy to Vercel | `.github/workflows/deploy.yml` | Maintainers only |
| Provision infrastructure | `infra/github/src/`, `infra/vercel/src/` | Maintainers only |
| Decrypt `.env` values | `dotenvx run --` | Maintainers with `DOTENV_PRIVATE_KEY` |

### For Contributors

- See `.env.example` for the full list of environment variables and their purpose
- Do **not** add plaintext secret values to `.env`, `.env.local`, or any tracked file
- If a workflow fails with a `DOTENV_PRIVATE_KEY` error, that workflow requires maintainer access
- Open a [GitHub Discussion](https://github.com/lorenzogm/bmad-ui/discussions) if you need help

### For Maintainers

- The decryption key lives in `.env.keys` (gitignored)
- Production secrets are encrypted in `.env` using dotenvx public-key encryption
- GitHub Secrets (`DOTENV_PRIVATE_KEY`, `TERRAFORM_STATE_ENCRYPT_KEY`) power the CI/CD pipeline

## Reporting Issues

- Search [existing issues](https://github.com/lorenzogm/bmad-ui/issues) first
- Use descriptive titles and include steps to reproduce
- Add the `good-first-issue` label if you think it's approachable for new contributors

## Questions?

Open a [GitHub Discussion](https://github.com/lorenzogm/bmad-ui/discussions) or an issue with the `question` label — we're happy to help.

Thanks for contributing! 🚀
