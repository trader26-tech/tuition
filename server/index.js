import express from 'express'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
const indexPath = path.join(distDir, 'index.html')

const app = express()
app.use(compression())

// Health check for Railway.
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

if (!fs.existsSync(distDir)) {
  console.warn('[server] dist/ not found — did you run "npm run build"?')
}

// Build the runtime config <script> that exposes the PUBLIC Supabase values to
// the browser. These are the public anon values only — never the service_role
// key. Doing this at serve time means one build works in any environment.
function runtimeConfigScript() {
  const cfg = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY:
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  }
  return `<script>window.__ENV__ = ${JSON.stringify(cfg)};</script>`
}

// Read index.html once at boot and cache the injected version.
let injectedHtml = ''
try {
  const raw = fs.readFileSync(indexPath, 'utf8')
  injectedHtml = raw.replace('<!--__RUNTIME_CONFIG__-->', runtimeConfigScript())
} catch {
  console.warn('[server] could not read dist/index.html yet')
}

// Serve hashed static assets with long cache; never cache index.html.
app.use(
  express.static(distDir, {
    index: false,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  })
)

// SPA fallback — always return the config-injected index.html.
app.get('*', (_req, res) => {
  if (!injectedHtml) {
    return res.status(500).send('App not built. Run "npm run build".')
  }
  res.setHeader('Cache-Control', 'no-cache')
  res.type('html').send(injectedHtml)
})

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${port}`)
})
