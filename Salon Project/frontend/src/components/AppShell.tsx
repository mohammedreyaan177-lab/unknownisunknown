import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSalonNow } from '../hooks/useSalonClock'
import { useAuth } from '../context/AuthContext'
import { Brand } from './Brand'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  adminOnly?: boolean
}

const PRIMARY: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: <GridIcon /> },
  { to: '/customers', label: 'Customers', icon: <PeopleIcon /> },
  { to: '/services', label: 'Services', icon: <ScissorsIcon /> },
  { to: '/staff', label: 'Staff', icon: <UserIcon /> },
  { to: '/appointments', label: 'Appointments', icon: <CalendarIcon /> },
]

export function AppShell() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  // One live clock for the shell; the interval lives in the hook and is torn
  // down when the shell unmounts.
  const now = useSalonNow()
  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(now.date)

  const items = PRIMARY.filter((item) => !item.adminOnly || isAdmin)

  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  /** Close the drawer and move focus to the new page on navigation. */
  const onNavigate = () => {
    setDrawerOpen(false)
    mainRef.current?.focus({ preventScroll: true })
  }

  const onSignOut = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <aside className="rail">
        <Brand />
        <nav className="rail__nav" aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rail__link ${isActive ? 'rail__link--active' : ''}`}
            >
              <span className="rail__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="rail__foot">
          <span className="rail__session">
            Signed in
            <strong>{user?.email ?? '—'}</strong>
            {user?.role}
          </span>
          <p className="rail__clock" aria-label="Current salon time">
            <span className="rail__clock-time tnum">{clock}</span>
            <span className="rail__clock-zone">Salon time · Asia/Kolkata</span>
          </p>
          <button type="button" className="btn btn--ghost btn--sm btn--block" onClick={onSignOut}>
            Switch account
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Brand />
        <button
          type="button"
          className="iconbtn"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon />
        </button>
      </header>

      {drawerOpen && (
        <div className="drawer" onMouseDown={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
          <div className="drawer__panel" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="drawer__head">
              <Brand />
              <button
                type="button"
                className="iconbtn"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="rail__nav" aria-label="Main">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `rail__link ${isActive ? 'rail__link--active' : ''}`}
                >
                  <span className="rail__icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="drawer__foot">
              <span className="rail__session">
                Signed in
                <strong>{user?.email ?? '—'}</strong>
              </span>
              <button type="button" className="btn btn--ghost btn--sm btn--block" onClick={onSignOut}>
                Switch account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="main">
        <main className="main__body" ref={mainRef} tabIndex={-1}>
          <div className="sheet view">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="2.4" y="2.4" width="5.6" height="5.6" rx="1" />
      <rect x="10" y="2.4" width="5.6" height="5.6" rx="1" />
      <rect x="2.4" y="10" width="5.6" height="5.6" rx="1" />
      <rect x="10" y="10" width="5.6" height="5.6" rx="1" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="7" cy="6" r="2.8" />
      <path d="M2.4 14.4c0-2.4 2.1-4 4.6-4s4.6 1.6 4.6 4" strokeLinecap="round" />
      <path d="M13 4.2a2.6 2.6 0 0 1 0 5M14.2 10.9c1.1.6 1.8 1.7 1.8 3" strokeLinecap="round" />
    </svg>
  )
}

function ScissorsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="4.4" cy="13.4" r="2.2" />
      <circle cx="4.4" cy="4.6" r="2.2" />
      <path d="M6.2 5.9l8.2 6.6M6.2 12.1l8.2-6.6" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="9" cy="5.8" r="3" />
      <path d="M3.4 15c0-2.9 2.5-4.8 5.6-4.8s5.6 1.9 5.6 4.8" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="2.4" y="3.6" width="13.2" height="12" rx="1.4" />
      <path d="M2.4 7.2h13.2M6 2.2v2.6M12 2.2v2.6" strokeLinecap="round" />
    </svg>
  )
}
