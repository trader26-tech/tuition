import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, dbReady } from './db.js'

// Secret for signing session tokens. Set SESSION_SECRET in production; falls
// back to a dev default so local runs work out of the box.
const SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'
const TOKEN_TTL = '30d'

// Turn a display name into a unique, lowercase login username.
export function toUsername(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.full_name, username: user.username },
    SECRET,
    { expiresIn: TOKEN_TTL }
  )
}

// Express middleware: verify the Bearer token and attach req.user. We also
// confirm the user still exists in app_users, so a valid-but-stale token (e.g.
// issued before the schema was re-created) can't be used to write rows with a
// dangling created_by/student_id. In that case we ask the user to sign in again.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not signed in.' })
  try {
    const payload = jwt.verify(token, SECRET)
    if (dbReady) {
      const { data: exists } = await db
        .from('app_users')
        .select('id, role, full_name, username')
        .eq('id', payload.sub)
        .maybeSingle()
      if (!exists)
        return res
          .status(401)
          .json({ error: 'Your account was reset. Please sign in again.' })
      req.user = exists // use the fresh row (role/name may have changed)
      return next()
    }
    req.user = { id: payload.sub, role: payload.role, full_name: payload.name, username: payload.username }
    next()
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' })
  }
}

export function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher')
    return res.status(403).json({ error: 'Only the teacher can do this.' })
  next()
}

const router = express.Router()

function ensureReady(res) {
  if (!dbReady) {
    res.status(500).json({
      error:
        'Server not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    })
    return false
  }
  return true
}

// POST /api/auth/signup  { fullName, password, role }
router.post('/signup', async (req, res) => {
  if (!ensureReady(res)) return
  const { fullName, password, role } = req.body || {}
  const username = toUsername(fullName)

  if (username.length < 2)
    return res.status(400).json({ error: 'Please enter a name (at least 2 letters).' })
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  const cleanRole = role === 'teacher' ? 'teacher' : 'student'

  // Name already taken?
  const { data: existing } = await db
    .from('app_users')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing)
    return res.status(409).json({
      error: `The name "${fullName.trim()}" is already taken. Try adding a number, e.g. "${fullName.trim()} 2".`,
    })

  const password_hash = await bcrypt.hash(password, 10)
  const { data: user, error } = await db
    .from('app_users')
    .insert({ username, full_name: fullName.trim(), password_hash, role: cleanRole })
    .select('id, username, full_name, role')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.json({ token: signToken(user), user })
})

// POST /api/auth/login  { fullName, password }
router.post('/login', async (req, res) => {
  if (!ensureReady(res)) return
  const { fullName, password } = req.body || {}
  const username = toUsername(fullName)

  const { data: user } = await db
    .from('app_users')
    .select('id, username, full_name, role, password_hash')
    .eq('username', username)
    .maybeSingle()

  const ok = user && (await bcrypt.compare(password || '', user.password_hash))
  if (!ok)
    return res
      .status(401)
      .json({ error: 'That name and password don’t match. Please try again.' })

  const safe = { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
  res.json({ token: signToken(safe), user: safe })
})

// GET /api/auth/me  (verify token, return current user)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
