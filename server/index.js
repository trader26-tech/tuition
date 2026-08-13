import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Surface any crash loudly (so it appears in Railway logs) instead of the
// process silently exiting and failing the healthcheck.
process.on('uncaughtException', (e) => console.error('[fatal] uncaughtException', e))
process.on('unhandledRejection', (e) => console.error('[fatal] unhandledRejection', e))

// Load a local .env for development (Railway injects real env vars, so this is
// only used when a .env file is present). Minimal parser — no dependency.
const envFile = path.join(__dirname, '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist')
const indexPath = path.join(distDir, 'index.html')

const app = express()
app.use(compression())
app.use(express.json({ limit: '2mb' }))

// Health check for Railway — registered FIRST and with no dependencies, so it
// responds even if something else in the app is misconfigured.
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// Start listening immediately, THEN wire up the rest. This guarantees the
// healthcheck can pass even while routers load, and any router import error is
// logged rather than preventing the server from ever binding the port.
const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${port}`)
})

try {
  const { default: authRouter } = await import('./auth.js')
  const { default: apiRouter } = await import('./api.js')
  app.use('/api/auth', authRouter)
  app.use('/api', apiRouter)
  console.log('[server] API routes mounted')
} catch (e) {
  console.error('[server] Failed to mount API routes:', e)
  // API returns a clear error rather than a blank crash.
  app.use('/api', (_req, res) =>
    res.status(500).json({ error: 'API failed to start. Check server logs.' })
  )
}

// ─── Static app ───
if (!fs.existsSync(distDir)) {
  console.warn('[server] dist/ not found — did you run "npm run build"?')
}
app.use(express.static(distDir, { index: false, maxAge: '1y' }))

// SPA fallback for any non-API route.
app.get('*', (_req, res) => {
  if (!fs.existsSync(indexPath)) {
    return res.status(500).send('App not built. Run "npm run build".')
  }
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(indexPath)
})
