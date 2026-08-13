import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui'
import { Icon } from '../components/icons'
// Preview the login name the same way the server does.
const previewUsername = (name) =>
  (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [role, setRole] = useState('student')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (previewUsername(fullName).length < 2) {
      setError('Please enter a name (at least 2 letters).')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      const { error } =
        mode === 'signin'
          ? await signIn({ fullName, password })
          : await signUp({ fullName, password, role })
      // The API returns clear, friendly messages already.
      if (error) setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Icon.Book width={20} />
          </div>
          Tuition Center
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Assignments, grading & schedules — all in one place.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Post assignments, let students upload their answers, mark them right
            on the page, and plan every tuition and meeting from a single
            dashboard.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-50">
            {[
              'Students upload PDFs & photos of their work',
              'Correct answers with a red pen, on any document',
              'A clear timeline of tuitions and meetings',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  <Icon.Check width={13} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Built for a tuition center.</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
              <Icon.Book width={22} /> Tuition Center
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {mode === 'signin'
              ? 'Enter your name and password to sign in.'
              : 'Just pick a name and password — that’s it.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Role selector — only needed when creating an account. */}
            {mode === 'signup' && (
              <div>
                <label className="label">I am a…</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'student', label: 'Student' },
                    { v: 'teacher', label: 'Teacher' },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.v}
                      onClick={() => setRole(o.v)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        role === o.v
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                autoFocus
                required
              />
              {mode === 'signup' && fullName.trim() && (
                <p className="mt-1 text-xs text-ink-400">
                  Your login name will be “{previewUsername(fullName)}”.
                </p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError('')
              }}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
