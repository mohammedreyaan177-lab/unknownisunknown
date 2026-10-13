import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  note?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, note, actions }: PageHeaderProps) {
  return (
    <header className="head">
      <div className="head__text">
        <span className="head__eyebrow">{eyebrow}</span>
        <h1 className="head__title">{title}</h1>
        {note && <p className="head__note">{note}</p>}
      </div>
      {actions && <div className="head__actions">{actions}</div>}
    </header>
  )
}
