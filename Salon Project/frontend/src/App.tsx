import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppointmentsPage } from './components/appointments/AppointmentsPage'
import { CustomersPage } from './components/customers/CustomersPage'
import { ServicesPage } from './components/services/ServicesPage'
import { StaffPage } from './components/staff/StaffPage'
import { EmptyState } from './components/ui/States'
import { useAuth } from './context/AuthContext'
import { SalonDataProvider } from './context/SalonDataContext'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OverviewPage } from './pages/OverviewPage'

export function App() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/overview" replace /> : <LoginPage />}
      />

      <Route
        element={
          user ? (
            <SalonDataProvider>
              <AppShell />
            </SalonDataProvider>
          ) : (
            <Navigate to="/login" replace state={{ from: location.pathname }} />
          )
        }
      >
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/staff" element={<StaffRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

/** Staff routes are admin-gated on the backend, so the UI gates them too. */
function StaffRoute() {
  const { isAdmin } = useAuth()
  if (isAdmin) return <StaffPage />
  return (
    <div className="panel">
      <EmptyState
        title="Staff records are admin-only"
        text="Your account cannot reach the staff endpoints. Ask an administrator if you need team access."
      />
    </div>
  )
}
