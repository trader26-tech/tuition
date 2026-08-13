import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

// Import routers AFTER env is loaded (they read process.env at import time).
const { default: authRouter } = await import('./auth.js')
const { default: apiRouter } = await import('./api.js')
const distDir = path.join(__dirname, '..', 'dist')
const indexPath = path.join(distDir, 'index.html')

const app = express()
app.use(compression())
app.use(express.json({ limit: '2mb' }))

// Health check for Railway.
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// ─── API ───
app.use('/api/auth', authRouter)
app.use('/api', apiRouter)

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

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${port}`)
})
