export type DocEntry = {
  id: string
  name: string
  path: string
  description: string
}

export const KNOWN_DOCS: readonly DocEntry[] = [
  {
    id: "README.md",
    name: "README",
    path: "README.md",
    description: "Project overview and quick start",
  },
  {
    id: "docs_setup.md",
    name: "Setup Guide",
    path: "docs/setup.md",
    description: "Local development setup",
  },
  {
    id: "docs_deployment-guide.md",
    name: "Deployment Guide",
    path: "docs/deployment-guide.md",
    description: "Deploy to Vercel",
  },
  {
    id: "github_CONTRIBUTING.md",
    name: "Contributing",
    path: ".github/CONTRIBUTING.md",
    description: "How to contribute",
  },
] as const
