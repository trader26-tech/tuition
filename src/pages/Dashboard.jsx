import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/icons'
import { Spinner, Badge } from '../components/ui'
import { dueLabel, fmtDateTime, relative } from '../lib/format'

function StatCard({ icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-ink-900">{value}</p>
        <p className="text-sm text-ink-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, isTeacher } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [upcoming, setUpcoming] = useState([])
  const [recentAssignments, setRecentAssignments] = useState([])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const nowIso = new Date().toISOString()

      const [assignmentsRes, submissionsRes, eventsRes] = await Promise.all([
        supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('submissions').select('id, status, score'),
        supabase
          .from('schedule_events')
          .select('*')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(5),
      ])

      if (!active) return

      const assignments = assignmentsRes.data || []
      const submissions = submissionsRes.data || []
      const events = eventsRes.data || []

      if (isTeacher) {
        const ungraded = submissions.filter((s) => s.status === 'submitted').length
        setStats({
          assignments: assignments.length,
          submissions: submissions.length,
          ungraded,
          events: events.length,
        })
      } else {
        const mine = submissions // RLS already scopes to the student's own
        const graded = mine.filter((s) => s.status === 'graded').length
        setStats({
          assignments: assignments.length,
          submitted: mine.length,
          graded,
          events: events.length,
        })
      }

      setUpcoming(events)
      setRecentAssignments(assignments.slice(0, 5))
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [isTeacher])

  if (loading)
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    )

  const firstName = (profile?.full_name || '').split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          {firstName ? `Hello, ${firstName} 👋` : 'Welcome 👋'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {isTeacher
            ? "Here's what's happening at your tuition center."
            : "Here's your work at a glance."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Icon.Book width={22} />} label="Assignments" value={stats.assignments ?? 0} />
        {isTeacher ? (
          <>
            <StatCard icon={<Icon.Upload width={22} />} label="Submissions" value={stats.submissions ?? 0} tone="purple" />
            <StatCard icon={<Icon.Pen width={22} />} label="Need grading" value={stats.ungraded ?? 0} tone="amber" />
          </>
        ) : (
          <>
            <StatCard icon={<Icon.Upload width={22} />} label="Submitted" value={stats.submitted ?? 0} tone="purple" />
            <StatCard icon={<Icon.Check width={22} />} label="Graded" value={stats.graded ?? 0} tone="green" />
          </>
        )}
        <StatCard icon={<Icon.Calendar width={22} />} label="Upcoming" value={stats.events ?? 0} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent assignments */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Recent assignments</h2>
            <Link to="/assignments" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {recentAssignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">No assignments yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentAssignments.map((a) => {
                const due = dueLabel(a.due_date)
                return (
                  <li key={a.id}>
                    <Link
                      to={`/assignments/${a.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-ink-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon.File width={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-800">{a.title}</p>
                        <p className="truncate text-xs text-ink-400">
                          {a.subject || 'General'} · added {relative(a.created_at)}
                        </p>
                      </div>
                      <Badge tone={due.tone}>{due.text}</Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Upcoming schedule */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Upcoming schedule</h2>
            <Link to="/schedule" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Icon.Clock width={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{e.title}</p>
                    <p className="text-xs text-ink-400">{fmtDateTime(e.starts_at)}</p>
                  </div>
                  <Badge tone="gray">{e.kind}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
