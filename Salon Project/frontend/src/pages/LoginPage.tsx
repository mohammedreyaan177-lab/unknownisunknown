import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage, useAuth } from '../context/AuthContext'
import { Brand } from '../components/Brand'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { InlineAlert } from '../components/ui/States'
import {
  recentAccounts,
  rememberAccount,
  type AccountRole,
  type RememberedAccount,
} from '../lib/recentAccounts'

type Choice = AccountRole | 'any'

const CHOICES: { key: Choice; label: string; hint: string }[] = [
  { key: 'admin', label: 'Admin', hint: 'Full access, including the team list' },
  { key: 'staff', label: 'Staff', hint: 'Clients, services and appointments' },
]

export function LoginPage() {
  const { signIn, user, signOut } = useAuth()
  const navigate = useNavigate()

  const [choice, setChoice] = useState<Choice>('any')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [known, setKnown] = useState<RememberedAccount[]>(() => recentAccounts())

  useEffect(() => {
    if (user) navigate('/overview', { replace: true })
  }, [user, navigate])

  // Accounts matching the chosen desk. "Any" shows every remembered sign-in.
  const offered = useMemo(
    () => (choice === 'any' ? known : known.filter((a) => a.role === choice)),
    [known, choice],
  )

  const chooseDesk = (next: Choice) => {
    setChoice(next)
    setError(null)
  }

  const pickAccount = (account: RememberedAccount) => {
    setEmail(account.email)
    setPassword('')
    setError(null)
    document.getElementById('login-password')?.focus()
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (!email.trim()) return setError('Enter the email address for this account.')
    if (!password) return setError('Enter your password.')

    setSubmitting(true)
    try {
      const session = await signIn(email.trim(), password)
      // The server decides the role; the desk the user picked is only a scope
      // for the account list. If they picked a different desk, say so instead
      // of signing them into a surface they did not ask for.
      if (choice !== 'any' && session.role !== choice) {
        rememberAccount(email, session.role === 'admin' ? 'admin' : 'staff')
        setKnown(recentAccounts())
        signOut()
        const wanted = choice === 'admin' ? 'an administrator' : 'a staff member'
        setError(`That account is ${session.role === 'admin' ? 'an administrator' : 'a staff member'}, not ${wanted}. Pick the matching desk or use another account.`)
        return
      }
      // Only a successful, correctly scoped sign-in is remembered.
      rememberAccount(email, session.role === 'admin' ? 'admin' : 'staff')
      setKnown(recentAccounts())
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Those details did not match an account.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <section className="auth__editorial" aria-hidden="true">
        <Brand />
        <div>
          <h1 className="auth__statement">
            The day, <em>beautifully</em> under control.
          </h1>
          <p className="auth__blurb">
            One desk for every client, every chair, and every hour of the day — bookings,
            services and the people who deliver them.
          </p>
        </div>
        <div className="auth__hours">
          <span>Skin · Hair · Beauty</span>
          <span>Salon operations</span>
        </div>
      </section>

      <section className="auth__panel">
        <form className="auth__form" onSubmit={onSubmit} noValidate>
          <span className="section-title">Staff access</span>
          <h2 className="auth__title">Sign in</h2>
          <p className="auth__sub">Use the account issued by your salon administrator.</p>

          <fieldset className="desk" disabled={submitting}>
            <legend className="desk__legend">Signing in at the</legend>
            <div className="desk__options">
              {CHOICES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`desk__option ${choice === option.key ? 'desk__option--on' : ''}`}
                  aria-pressed={choice === option.key}
                  onClick={() => chooseDesk(option.key)}
                >
                  <span className="desk__option-label">{option.label}</span>
                  <span className="desk__option-hint">{option.hint}</span>
                </button>
              ))}
            </div>
            {choice !== 'any' && known.length > 0 && offered.length === 0 && (
              <p className="desk__empty">
                No {choice} account has signed in here yet. Enter the details below.
              </p>
            )}
          </fieldset>

          {offered.length > 0 && (
            <div className="accounts">
              <span className="section-title" id="accounts-label">
                {choice === 'any' ? 'Recent sign-ins' : `Recent ${choice} sign-ins`}
              </span>
              <ul className="accounts__list" aria-labelledby="accounts-label">
                {offered.map((account) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      className={`account ${account.email === email.trim().toLowerCase() ? 'account--on' : ''}`}
                      onClick={() => pickAccount(account)}
                      disabled={submitting}
                    >
                      <span className="account__role">{account.role}</span>
                      {account.email}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="auth__fields">
            {error && <InlineAlert message={error} />}

            <TextField
              label="Email"
              type="email"
              name="email"
              id="login-email"
              autoComplete="username"
              placeholder="you@salon.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />

            <TextField
              label="Password"
              type="password"
              name="password"
              id="login-password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />

            <Button type="submit" variant="primary" block loading={submitting}>
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}