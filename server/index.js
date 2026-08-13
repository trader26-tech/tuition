import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const app = express()
app.use(compression())

// Health check for Railway.
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// Expose the public Supabase config to the browser at runtime, so the same
// build can be deployed to any environment without rebuilding. These are the
// PUBLIC anon values only — never the service_role key.
app.get('/config.js', (_req, res) => {
  const cfg = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY:
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  }
  res.type('application/javascript')
  res.send(`window.__ENV__ = ${JSON.stringify(cfg)};`)
})

if (!fs.existsSync(distDir)) {
  console.warn('[server] dist/ not found — did you run "npm run build"?')
}

app.use(
  express.static(distDir, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  })
)

// SPA fallback.
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${port}`)
})
