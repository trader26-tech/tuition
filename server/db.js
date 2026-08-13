import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using the SERVICE ROLE key. This stays on the
// server only — never sent to the browser. It has full DB + storage access;
// our API is responsible for enforcing who can do what.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

export const dbReady = Boolean(url && serviceKey)

if (!dbReady) {
  console.warn(
    '[db] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — the API will ' +
      'return a setup error until these are set.'
  )
}

// This app only uses the database + storage — never Supabase Realtime. On older
// Node versions the client's realtime setup can throw ("native WebSocket not
// found"). We don't need it at all, so we keep the client construction guarded
// and realtime disabled.
export const db = (() => {
  if (!dbReady) return null
  try {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: {} }, // we never subscribe; keep it inert
    })
  } catch (e) {
    console.error('[db] Failed to create Supabase client:', e.message)
    return null
  }
})()

export const BUCKET = 'submissions'
