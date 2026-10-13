/**
 * Shared helpers for the development probe/seed scripts.
 *
 * These talk to the real backend over HTTP exactly as the browser does — no
 * database access, no mocked responses — so anything they verify is verified
 * against the actual API contract.
 */

export const API = process.env.API_BASE ?? 'http://localhost:3000'

/** Credentials come from the environment so nothing is committed to the repo. */
const EMAIL = process.env.PROBE_EMAIL
const PASSWORD = process.env.PROBE_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error(
    'Set PROBE_EMAIL and PROBE_PASSWORD to an account in your development database.\n' +
      'These are read from the environment and never written to disk.',
  )
  process.exit(2)
}

export async function login(email = EMAIL, password = PASSWORD) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  if (!res.ok || !body.token) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`)
  }
  return body.token
}

export const ADMIN_TOKEN = await login()

/** Thin authenticated request wrapper returning status + parsed body. */
export async function call(method, path, body, token = ADMIN_TOKEN) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { raw: text }
  }
  return { status: res.status, body: parsed }
}