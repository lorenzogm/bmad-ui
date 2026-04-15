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

### Prerequisites

- Node.js 18+
- pnpm 10.16+

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run quality checks
pnpm run check:types
pnpm run check:tests
```

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

See [.github/pull_request_template.md](.github/pull_request_template.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

For questions or issues, please open an issue on GitHub or refer to the [BMAD documentation](https://github.com/lorenzogm/bmad-ui).
