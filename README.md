# BMAD UI

Visual companion for BMAD agentic development workflows.

## Overview

BMAD UI is a React-based web application that provides real-time visibility into AI agent orchestration, sprint progress tracking, and workflow management. It serves as the visual interface for the BMAD (Build Manage Analyze Deploy) multi-agent system.

## Features

- **Workflow Monitoring**: Real-time tracking of agentic workflows and task execution
- **Sprint Management**: Visual sprint progress tracking with story and epic analytics
- **Session Analytics**: Comprehensive analytics for agent sessions and interactions
- **Responsive Design**: Modern dark-themed UI optimized for developer workflows

## Tech Stack

- **Framework**: React 19.2.0 + TypeScript 5.9.2
- **Build Tool**: Vite 7.1.7
- **Routing**: TanStack Router 1.168.15
- **Styling**: Tailwind CSS 4.1.18
- **State Management**: TanStack Query 5
- **Testing**: Vitest 4.0.1
- **Linting**: Biome

## Quick Start

> No secrets or environment variables required — the full app runs immediately after install.

### Prerequisites

- Node.js 18+ (current LTS recommended)
- pnpm 10.16+ — install with `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`

### Setup

```bash
# Move into the app workspace
cd _bmad-custom/bmad-ui

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open `http://localhost:5173` — you should see the BMAD UI dashboard.

### Validate

```bash
pnpm run check   # lint + types + tests + build (run before every commit)
```

> **Setup issues?** See [Troubleshooting](docs/development-guide-bmad-ui.md#troubleshooting) in the development guide.

## Deployment

> No secrets required for local dev — the setup above is all contributors need.
>
> **Maintainers**: deploying to Vercel requires `DOTENV_PRIVATE_KEY` (and `TERRAFORM_STATE_ENCRYPT_KEY`) to be set as GitHub repository secrets. See [docs/deployment-guide.md](docs/deployment-guide.md) for the full deployment setup, secret prerequisites, preview vs. production paths, and new maintainer onboarding.

## Project Structure

```
_bmad-custom/bmad-ui/
├── src/
│   ├── main.tsx           # React app entry point
│   ├── app.tsx            # Root component
│   ├── styles.css         # Global styles
│   ├── types.ts           # Shared TypeScript types
│   └── routes/            # Route components
├── index.html             # HTML template
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── biome.json             # Biome linter/formatter config
└── package.json           # Dependencies
```

## Development Workflow

### Code Quality

All code must pass:

- **TypeScript**: `pnpm run check:types`
- **Linting**: `biome check src/`
- **Build**: `pnpm run build`
- **Tests**: `pnpm run check:tests`

### Code Style

- Use `@/*` path aliases for imports
- Use `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()`
- Centralize shared types in `src/types.ts`
- Use named exports only
- Use TanStack Query for data fetching (no `useEffect` for async operations)

## Architecture

For detailed architecture documentation, see [_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md).

## Contributing

We welcome contributions! Here's how you can help:
### Reporting Issues
- [Check existing issues](https://github.com/lorenzogm/bmad-ui/issues) first to avoid duplicates
- Describe the problem and steps to reproduce
- Include your environment (OS, Node version, browser, etc.)
- Use the appropriate label (e.g., `bug`, `enhancement`, `question`)
### Submitting Pull Requests
1. Fork the repository
2. Create a branch from `main`: `git checkout -b feature/your-feature`
3. Make your changes and commit with clear messages
4. Run quality checks: `cd _bmad-custom/bmad-ui && pnpm run check:types && pnpm run check:tests`
5. Push to your fork and open a PR against `main`
6. Ensure all CI checks pass before requesting review
See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

For questions or issues, please open an issue on GitHub or refer to the [BMAD documentation](https://github.com/lorenzogm/bmad-ui).

**Troubleshooting common failures?** See [docs/troubleshooting.md](docs/troubleshooting.md) for a matrix of local runtime, CI validation, secrets, and deployment failures with symptoms, causes, resolution steps, and evidence to collect.
