/**
 * Remembers which salon accounts have signed in on this device so the front
 * desk can hop between an admin and a staff login without hunting for the
 * email address. Only the address and the role the server actually issued are
 * kept — never a password or a token — and it is local to this browser.
 *
 * The role is stored, never chosen: it is read back off the JWT the backend
 * signed, so it reflects what the server will actually allow.
 */
const KEY = 'shades360.accounts'
const MAX = 5

export type AccountRole = 'admin' | 'staff'

export interface RememberedAccount {
  email: string
  role: AccountRole
  at: number
}

function read(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => {
        const e = entry as Partial<RememberedAccount>
        if (typeof e?.email !== 'string' || !e.email) return null
        const role: AccountRole = e.role === 'admin' ? 'admin' : 'staff'
        return { email: e.email, role, at: typeof e.at === 'number' ? e.at : 0 }
      })
      .filter((entry): entry is RememberedAccount => entry !== null)
  } catch {
    return []
  }
}

function save(list: RememberedAccount[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* storage unavailable — the list is a convenience, not a requirement */
  }
}

export function recentAccounts(): RememberedAccount[] {
  return read().sort((a, b) => b.at - a.at)
}

export function rememberAccount(email: string, role: AccountRole): void {
  const address = email.trim().toLowerCase()
  if (!address) return
  save([{ email: address, role, at: Date.now() }, ...read().filter((e) => e.email !== address)])
}

/** Records a role change for an account that was re-scoped by the user. */
export function relabelAccount(email: string, role: AccountRole): void {
  const address = email.trim().toLowerCase()
  save(read().map((e) => (e.email === address ? { ...e, role } : e)))
}