import { createClient } from '@supabase/supabase-js'

// Config resolution order:
//  1. Runtime config injected by the Express server via /config.js (production
//     on Railway) — window.__ENV__.
//  2. Vite build-time env vars (local `npm run dev`) — import.meta.env.
const runtime = typeof window !== 'undefined' ? window.__ENV__ || {} : {}

const url = runtime.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
const anonKey =
  runtime.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // Don't crash the whole app — the UI shows a friendly "not configured" screen.
  console.warn(
    '[supabase] Missing SUPABASE_URL / SUPABASE_ANON_KEY. ' +
      'Set them in your environment (see .env.example).'
  )
}

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
