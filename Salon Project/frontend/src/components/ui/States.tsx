import type { ReactNode } from 'react'

/** Loading placeholder. `rows` shapes a table skeleton; otherwise a block. */
export function Skeleton({ rows = 0, height = '1rem' }: { rows?: number; height?: string }) {
  if (rows > 0) {
    return (
      <div className="sk-rows" role="status" aria-label="Loading">
        <span className="visually-hidden">Loading…</span>
        {Array.from({ length: rows }, (_, i) => (
          <div className="sk-row" key={i} aria-hidden="true">
            <div className="sk" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%' }} />
            <div className="sk" style={{ height: '0.85rem', flex: '1 1 12rem' }} />
            <div className="sk" style={{ height: '0.85rem', flex: '0 1 8rem' }} />
            <div className="sk" style={{ height: '0.85rem', width: '5.5rem' }} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="sk" style={{ height }} role="status" aria-label="Loading">
      <span className="visually-hidden">Loading…</span>
    </div>
  )
}

interface StateProps {
  title: string
  text?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'danger'
}

export function EmptyState({ title, text, action, tone = 'neutral' }: StateProps) {
  return (
    <div className="state">
      <span className="state__mark" aria-hidden="true">
        {tone === 'danger' ? <CrossIcon /> : <InboxIcon />}
      </span>
      <h3 className="state__title">{title}</h3>
      {text && <p className="state__text">{text}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="state" role="alert">
      <span className="state__mark" aria-hidden="true">
        <CrossIcon />
      </span>
      <h3 className="state__title">{title}</h3>
      {message && <p className="state__text">{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn--outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function InlineAlert({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'info' }) {
  return (
    <div className={`alert alert--${tone}`} role="alert">
      <span className="alert__icon" aria-hidden="true">
        <CrossIcon />
      </span>
      <span>{message}</span>
    </div>
  )
}

function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M2.5 11.5h3l1 2h5l1-2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 3.2h10l1.5 8.3H2.5L4 3.2z" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" strokeLinecap="round" />
    </svg>
  )
}
