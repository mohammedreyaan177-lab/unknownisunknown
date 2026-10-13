/**
 * Create the salon's first administrator.
 *
 * WHY THIS IS A SCRIPT AND NOT AN ENDPOINT
 * ---------------------------------------
 * Self-registration used to accept a `role` from the request body, so anybody
 * could POST /auth/register with role:"admin" and take the whole salon. Admin
 * accounts are therefore no longer creatable over HTTP at all. This runs on the
 * owner's machine, reads its secrets from the environment (never from a request
 * body, so there is nothing an attacker can supply), and is the supported way to
 * bootstrap the first admin.
 *
 * USAGE
 *   Add these to backend/src/.env (do not commit them):
 *     ADMIN_NAME=Your Name
 *     ADMIN_EMAIL=you@salon.com
 *     ADMIN_PASSWORD=a-long-unique-password
 *   Then:
 *     npm run create-admin
 *
 * SAFETY
 *   - Refuses to run if any admin already exists, so it cannot be used to mint
 *     extra admins later. Pass --force only if you really mean it.
 *   - Refuses to overwrite an existing account with the same email.
 *   - Password is hashed with bcrypt (cost 10), matching the login path.
 *   - Never prints the password or the hash.
 */

require('dotenv').config()
const bcrypt = require('bcrypt')
const pool = require('../config/db')

const force = process.argv.includes('--force')

function fail(message) {
  console.error(`\n  ERROR: ${message}\n`)
  process.exit(1)
}

async function main() {
  const name = process.env.ADMIN_NAME
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!name || !email || !password) {
    fail('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must all be set in backend/src/.env')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`ADMIN_EMAIL "${email}" is not a valid email address`)
  }
  if (String(password).length < 8) {
    fail('ADMIN_PASSWORD must be at least 8 characters')
  }

  const existingAdmins = await pool.query(`select id, email from users where role = 'admin'`)
  if (existingAdmins.rows.length > 0 && !force) {
    console.log('\n  An administrator already exists, so nothing was created:')
    for (const a of existingAdmins.rows) console.log(`    - ${a.email} (id ${a.id})`)
    console.log('\n  Sign in as that account instead. To add another admin on purpose,')
    console.log('  re-run with --force.\n')
    await pool.end()
    return
  }

  const clash = await pool.query(`select id from users where email = $1`, [email])
  if (clash.rows.length > 0) {
    fail(`An account already uses ${email}. Use a different ADMIN_EMAIL, or reset that password.`)
  }

  const hashed = await bcrypt.hash(password, 10)
  const created = await pool.query(
    `insert into users (name, email, password, role) values ($1, $2, $3, 'admin') returning id, name, email, role`,
    [name, email, hashed],
  )

  console.log('\n  Administrator created:')
  console.log(`    id    ${created.rows[0].id}`)
  console.log(`    name  ${created.rows[0].name}`)
  console.log(`    email ${created.rows[0].email}`)
  console.log(`    role  ${created.rows[0].role}\n`)
  console.log('  Sign in at /login with that email and password.\n')

  await pool.end()
}

main().catch(async (err) => {
  console.error('\n  ERROR:', err.message, '\n')
  try {
    await pool.end()
  } catch {
    /* already closed */
  }
  process.exit(1)
})