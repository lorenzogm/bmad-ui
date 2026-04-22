// Shared UI components for loading, empty, and error states

export function PageSkeleton() {
  return (
    <main className="screen">
      <div className="panel h-24 animate-pulse opacity-40" />
      <div className="panel mt-4 h-40 animate-pulse opacity-30" />
      <div className="panel mt-4 h-32 animate-pulse opacity-20" />
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
  const descriptionNode = description ? (
    action ? (
      <p className="mb-6 text-[var(--muted)]">{description}</p>
    ) : (
      <p className="text-[var(--muted)]">{description}</p>
    )
  ) : null

  return (
    <main className="screen">
      <div className="panel px-8 py-12 text-center">
        {icon ? <p className="mb-4 text-[2.5rem]">{icon}</p> : null}
        <h2 className="mb-2 text-[var(--text)]">{title}</h2>
        {descriptionNode}
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
  onRetry?: () => unknown
}

export function QueryErrorState({ message, onRetry }: QueryErrorStateProps) {
  return (
    <main className="screen">
      <div className="panel border-[var(--highlight-2)]">
        <p className="eyebrow text-[var(--highlight-2)]">Error</p>
        <p className="mt-2 text-[var(--muted)]">{message}</p>
        {onRetry ? (
          <button
            className="ghost mt-4"
            onClick={() => {
              void onRetry()
            }}
            type="button"
          >
            Retry
          </button>
        ) : null}
      </div>
    </main>
  )
}
