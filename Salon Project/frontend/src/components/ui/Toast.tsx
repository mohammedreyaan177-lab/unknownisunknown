import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertIcon, CheckIcon } from './Modal'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: Tone
  title: string
  detail?: string
}

export interface ToastApi {
  success: (title: string, detail?: string) => void
  error: (title: string, detail?: string) => void
  info: (title: string, detail?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const LIFETIME: Record<Tone, number> = { success: 4200, info: 4200, error: 7000 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: Tone, title: string, detail?: string) => {
      const id = ++seq.current
      setToasts((list) => [...list.slice(-2), { id, tone, title, detail }])
    },
    [],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, detail) => push('success', title, detail),
      error: (title, detail) => push('error', title, detail),
      info: (title, detail) => push('info', title, detail),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toasts" aria-label="Notifications">
          {toasts.map((toast) => (
            <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { id, tone } = toast

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), LIFETIME[tone])
    return () => window.clearTimeout(timer)
  }, [id, tone, onDismiss])

  return (
    <div
      className={`toast toast--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span aria-hidden="true" style={{ marginTop: '0.1rem' }}>
        {tone === 'success' ? <CheckIcon /> : <AlertIcon />}
      </span>
      <span className="toast__text">
        <span className="toast__title">{toast.title}</span>
        {toast.detail && <span className="muted">{toast.detail}</span>}
      </span>
      <button type="button" className="iconbtn" aria-label="Dismiss notification" onClick={() => onDismiss(id)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
