// Shared UI components for loading, empty, and error states

export function PageSkeleton() {
  return (
    <main className="screen">
      <div className="panel animate-pulse" style={{ height: "6rem", opacity: 0.4 }} />
      <div
        className="panel animate-pulse"
        style={{ height: "10rem", opacity: 0.3, marginTop: "1rem" }}
      />
      <div
        className="panel animate-pulse"
        style={{ height: "8rem", opacity: 0.2, marginTop: "1rem" }}
      />
    </main>
  )
}

type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <main className="screen">
      <div className="panel" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        {icon ? <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{icon}</p> : null}
        <h2 style={{ color: "var(--text)", marginBottom: "0.5rem" }}>{title}</h2>
        {description ? (
          <p style={{ color: "var(--muted)", marginBottom: action ? "1.5rem" : 0 }}>
            {description}
          </p>
        ) : null}
        {action ? (
          <button className="cta" onClick={action.onClick} type="button">
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  )
}

type QueryErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function QueryErrorState({ message, onRetry }: QueryErrorStateProps) {
  return (
    <main className="screen">
      <div className="panel" style={{ borderColor: "var(--highlight-2)" }}>
        <p className="eyebrow" style={{ color: "var(--highlight-2)" }}>
          Error
        </p>
        <p className="mt-2" style={{ color: "var(--muted)" }}>
          {message}
        </p>
        {onRetry ? (
          <button className="ghost" onClick={onRetry} style={{ marginTop: "1rem" }} type="button">
            Retry
          </button>
        ) : null}
      </div>
    </main>
  )
}
