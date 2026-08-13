export default function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="card max-w-lg p-8">
        <h1 className="text-xl font-bold text-ink-900">Almost there 👋</h1>
        <p className="mt-2 text-sm text-ink-600">
          This dashboard isn't connected to Supabase yet. Add your Supabase
          credentials and it will spring to life.
        </p>
        <ol className="mt-5 space-y-3 text-sm text-ink-700">
          <li>
            <span className="font-semibold">1.</span> In Railway → your service →{' '}
            <span className="font-mono text-ink-900">Variables</span>, add:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-50">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key`}
            </pre>
          </li>
          <li>
            <span className="font-semibold">2.</span> Run{' '}
            <span className="font-mono">supabase/schema.sql</span> in the Supabase
            SQL editor.
          </li>
          <li>
            <span className="font-semibold">3.</span> Redeploy. Locally, copy{' '}
            <span className="font-mono">.env.example</span> to{' '}
            <span className="font-mono">.env</span> and run{' '}
            <span className="font-mono">npm run dev</span>.
          </li>
        </ol>
      </div>
    </div>
  )
}
