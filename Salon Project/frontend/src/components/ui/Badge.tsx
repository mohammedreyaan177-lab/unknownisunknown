import type { ReactNode } from 'react'
import type { AppointmentStatus } from '../../types'

type Tone = 'ok' | 'warn' | 'info' | 'danger' | 'quiet'

export function Badge({ tone = 'quiet', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

const STATUS_TONE: Record<string, Tone> = {
  BOOKED: 'info',
  CONFIRMED: 'ok',
  IN_PROGRESS: 'warn',
  COMPLETED: 'quiet',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
}

export function StatusBadge({ status }: { status: AppointmentStatus | string }) {
  const key = String(status).toUpperCase()
  return <Badge tone={STATUS_TONE[key] ?? 'quiet'}>{key.replace(/_/g, ' ')}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'ok' : 'quiet'}>{active ? 'Active' : 'Inactive'}</Badge>
}
