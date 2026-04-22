import { createRoute } from "@tanstack/react-router"
import { rootRoute } from "./__root"

type AgentEntry = {
  id: string
  name: string
  title: string
  icon: string
  role: string
  description: string
}

const AGENT_CATALOG: AgentEntry[] = [
  {
    id: "bmad-agent-analyst",
    name: "Mary",
    title: "Business Analyst",
    icon: "📊",
    role: "Strategic Business Analyst + Requirements Expert",
    description:
      "Market research, competitive analysis, requirements elicitation, domain expertise",
  },
  {
    id: "bmad-agent-tech-writer",
    name: "Paige",
    title: "Technical Writer",
    icon: "📚",
    role: "Technical Documentation Specialist + Knowledge Curator",
    description: "Documentation, Mermaid diagrams, standards compliance, concept explanation",
  },
  {
    id: "bmad-agent-pm",
    name: "John",
    title: "Product Manager",
    icon: "📋",
    role: "Product Manager",
    description: "PRD creation, requirements discovery, stakeholder alignment, user interviews",
  },
  {
    id: "bmad-agent-ux-designer",
    name: "Sally",
    title: "UX Designer",
    icon: "🎨",
    role: "User Experience Designer + UI Specialist",
    description: "User research, interaction design, UI patterns, experience strategy",
  },
  {
    id: "bmad-agent-architect",
    name: "Winston",
    title: "Architect",
    icon: "🏗️",
    role: "System Architect + Technical Design Leader",
    description: "Distributed systems, cloud infrastructure, API design, scalable patterns",
  },
  {
    id: "bmad-agent-dev",
    name: "Amelia",
    title: "Developer Agent",
    icon: "💻",
    role: "Senior Software Engineer",
    description: "Story execution, test-driven development, code implementation",
  },
]

function AgentCard(props: { agent: AgentEntry }) {
  const { agent } = props
  return (
    <div
      className="panel"
      style={{
        padding: "1.5rem",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ fontSize: "2rem", lineHeight: 1 }}>{agent.icon}</div>
      <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)" }}>
        {agent.name}
        <span
          style={{
            marginLeft: "0.5rem",
            fontSize: "0.8rem",
            color: "var(--highlight)",
            fontWeight: 500,
          }}
        >
          {agent.title}
        </span>
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
        {agent.role}
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--text)", opacity: 0.85 }}>
        {agent.description}
      </div>
      <div
        style={{
          marginTop: "auto",
          fontSize: "0.75rem",
          color: "var(--muted)",
          borderTop: "1px solid rgba(151, 177, 205, 0.12)",
          paddingTop: "0.5rem",
          opacity: 0.7,
        }}
      >
        {agent.id}
      </div>
    </div>
  )
}

function AgentsPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <p className="eyebrow">Agents</p>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "0.5rem",
        }}
      >
        BMAD Agent Catalog
      </h2>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Specialized AI agents that power the BMAD multi-agent workflow system.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {AGENT_CATALOG.map((agent) => (
          <AgentCard agent={agent} key={agent.id} />
        ))}
      </div>
    </div>
  )
}

export const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agents",
  component: AgentsPage,
})
