# Contributing to bmad-ui

Thank you for your interest in contributing to bmad-ui! We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

## Getting Started

- [Development Guide](../docs/development-guide-bmad-ui.md) — local setup and dev workflow
- [Project Overview](../docs/project-overview.md) — codebase structure and architecture

### Local Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run quality checks
pnpm run check:types
pnpm run check:tests
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
   pnpm run check:types   # TypeScript type check
   pnpm run check:tests   # Vitest test suite
   ```
4. Commit with clear, descriptive messages

### Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `main` with a clear title and description
3. Link related issues: `Closes #123`
4. Ensure all CI checks pass (TypeScript, Biome lint, build, tests)
5. Address any review feedback promptly
6. Do not force-push after a review has started

## Code Quality

| Tool | Command | Purpose |
|------|---------|---------|
| **Biome** | `biome check src/` | Linting + formatting |
| **TypeScript** | `pnpm run check:types` | Type checking |
| **Vitest** | `pnpm run check:tests` | Unit tests |
| **Vite** | `pnpm run build` | Production build check |

See [Project Context](_bmad-output/project-context.md) for detailed coding rules and patterns.

## Reporting Issues

- Search [existing issues](https://github.com/lorenzogm/bmad-ui/issues) first
- Use descriptive titles and include steps to reproduce
- Add the `good-first-issue` label if you think it's approachable for new contributors

## Questions?

Open a [GitHub Discussion](https://github.com/lorenzogm/bmad-ui/discussions) or an issue with the `question` label — we're happy to help.

Thanks for contributing! 🚀
