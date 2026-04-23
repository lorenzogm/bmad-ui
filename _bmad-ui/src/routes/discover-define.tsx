import { createRoute, Link } from "@tanstack/react-router"
import { rootRoute } from "./__root"

type Phase = {
  id: string
  title: string
  description: string
  phaseId: string
}

const DISCOVER_DEFINE_PHASES: readonly Phase[] = [
  {
    id: "analysis",
    title: "Analysis",
    description:
      "Conduct domain and market research, competitive analysis, and user discovery. Build the knowledge foundation for the project.",
    phaseId: "analysis",
  },
  {
    id: "planning",
    title: "Planning",
    description:
      "Create product requirements, define scope, and establish the product roadmap. Align stakeholders and clarify goals.",
    phaseId: "planning",
  },
  {
    id: "solutioning",
    title: "Solutioning",
    description:
      "Design the technical architecture, UX patterns, and implementation blueprint. Prepare for development.",
    phaseId: "solutioning",
  },
] as const

function PhaseAccordion(props: { phase: Phase }) {
  const { phase } = props
  return (
    <details
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(151, 177, 205, 0.22)" }}
    >
      <summary
        className="flex items-center justify-between cursor-pointer px-5 py-4"
        style={{
          background: "rgba(2, 10, 16, 0.66)",
          listStyle: "none",
          userSelect: "none",
        }}
      >
        <span className="text-base font-semibold" style={{ color: "var(--text)" }}>
          {phase.title}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          ▸
        </span>
      </summary>
      <div
        className="px-5 py-4 flex flex-col gap-3"
        style={{ background: "rgba(10, 19, 29, 0.6)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          {phase.description}
        </p>
        <div>
          <Link
            className="text-sm"
            params={{ phaseId: phase.phaseId }}
            style={{ color: "var(--highlight)", textDecoration: "none" }}
            to="/workflow/$phaseId"
          >
            Go to full view →
          </Link>
        </div>
      </div>
    </details>
  )
}

function DiscoverDefinePage() {
  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Discover &amp; Define</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Research &amp; Planning
        </h1>
        <p className="subtitle mb-6">
          Explore the three phases that shape your product before development begins.
        </p>
        <div className="flex flex-col gap-3">
          {DISCOVER_DEFINE_PHASES.map((phase) => (
            <PhaseAccordion key={phase.id} phase={phase} />
          ))}
        </div>
      </section>
    </main>
  )
}

export const discoverDefineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover-define",
  component: DiscoverDefinePage,
})
