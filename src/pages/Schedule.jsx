import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/icons'
import { Spinner, Badge, Modal, EmptyState } from '../components/ui'
import { fmtTime, toLocalInput } from '../lib/format'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

const KIND_META = {
  tuition: { label: 'Tuition', tone: 'blue', dot: 'bg-brand-500' },
  meeting: { label: 'Meeting', tone: 'purple', dot: 'bg-purple-500' },
  exam: { label: 'Exam', tone: 'red', dot: 'bg-red-500' },
  other: { label: 'Other', tone: 'gray', dot: 'bg-ink-400' },
}

function dayHeading(date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE, d MMM yyyy')
}

export default function Schedule() {
  const { isTeacher } = useAuth()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState('upcoming')

  const load = async () => {
    setLoading(true)
    try {
      setEvents((await api.get('/schedule')) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => !isPast(new Date(e.ends_at || e.starts_at)))
  }, [events, filter])

  const groups = useMemo(() => {
    const g = {}
    filtered.forEach((e) => {
      const key = format(new Date(e.starts_at), 'yyyy-MM-dd')
      g[key] = g[key] || []
      g[key].push(e)
    })
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Schedule</h1>
          <p className="mt-1 text-sm text-ink-500">
            {isTeacher
              ? 'Plan tuitions, meetings and exams — and who attends.'
              : 'Your upcoming tuitions and meetings.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 bg-white p-0.5 text-sm">
            {[
              { v: 'upcoming', label: 'Upcoming' },
              { v: 'all', label: 'All' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setFilter(o.v)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  filter === o.v ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {isTeacher && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Icon.Plus width={18} /> New event
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Icon.Calendar width={22} />}
          title={filter === 'upcoming' ? 'Nothing coming up' : 'No events yet'}
          action={
            isTeacher ? (
              <button className="btn-primary mt-2" onClick={() => setShowCreate(true)}>
                <Icon.Plus width={18} /> Schedule something
              </button>
            ) : null
          }
        >
          {isTeacher
            ? 'Add a tuition session, meeting or exam and it will show on this timeline.'
            : 'When your teacher schedules a session for you, it appears here.'}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map(([day, dayEvents]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                  {dayHeading(new Date(day))}
                </h2>
                <span className="text-xs text-ink-400">
                  {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {dayEvents.map((e) => (
                  <EventCard key={e.id} event={e} isTeacher={isTeacher} onDeleted={load} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false)
          load()
        }}
      />
    </div>
  )
}

function EventCard({ event, isTeacher, onDeleted }) {
  const meta = KIND_META[event.kind] || KIND_META.other
  const [busy, setBusy] = useState(false)
  const attendees = event.attendees || []

  const del = async () => {
    if (!confirm('Delete this event?')) return
    setBusy(true)
    await api.del(`/schedule/${event.id}`)
    onDeleted()
  }

  return (
    <div className="card flex gap-4 p-4">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-ink-50 py-2">
        <span className="text-sm font-bold text-ink-800">{fmtTime(event.starts_at)}</span>
        {event.ends_at && <span className="text-xs text-ink-400">{fmtTime(event.ends_at)}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <h3 className="font-semibold text-ink-900">{event.title}</h3>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          {event.subject && <span>📘 {event.subject}</span>}
          {event.location && <span>📍 {event.location}</span>}
          {attendees.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon.Users width={13} /> {attendees.length} student{attendees.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {event.notes && <p className="mt-2 text-sm text-ink-600">{event.notes}</p>}
        {isTeacher && attendees.length > 0 && (
          <p className="mt-2 text-xs text-ink-400">{attendees.map((a) => a.name).join(', ')}</p>
        )}
      </div>

      {isTeacher && (
        <button
          onClick={del}
          disabled={busy}
          className="btn-ghost h-8 self-start px-2 text-ink-400 hover:text-red-600"
          aria-label="Delete event"
        >
          {busy ? <Spinner className="h-4 w-4" /> : <Icon.Trash width={16} />}
        </button>
      )}
    </div>
  )
}

function CreateEventModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    kind: 'tuition',
    subject: '',
    location: '',
    notes: '',
    starts_at: toLocalInput(),
    ends_at: '',
  })
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    api.get('/users/students').then(setStudents).catch(() => setStudents([]))
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/schedule', {
        title: form.title,
        kind: form.kind,
        subject: form.subject,
        location: form.location,
        notes: form.notes,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        attendees: [...selected],
      })
      setForm({ title: '', kind: 'tuition', subject: '', location: '', notes: '', starts_at: toLocalInput(), ends_at: '' })
      setSelected(new Set())
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New event" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Physics tuition — Batch A" required />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.kind} onChange={set('kind')}>
              {Object.entries(KIND_META).map(([v, m]) => (
                <option key={v} value={v}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={set('subject')} placeholder="e.g. Physics" />
          </div>
          <div>
            <label className="label">Starts</label>
            <input className="input" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
          </div>
          <div>
            <label className="label">Ends (optional)</label>
            <input className="input" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Location (optional)</label>
            <input className="input" value={form.location} onChange={set('location')} placeholder="e.g. Room 2 / Online (Zoom)" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes (optional)</label>
            <textarea className="input min-h-[70px]" value={form.notes} onChange={set('notes')} placeholder="Anything to remember…" />
          </div>
        </div>

        <div>
          <label className="label">Who's attending? (optional)</label>
          {students.length === 0 ? (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-400">
              No student accounts yet. Students you add later can be attached to future events.
            </p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
              {students.map((st) => (
                <label
                  key={st.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={selected.has(st.id)}
                    onChange={() => toggle(st.id)}
                  />
                  {st.full_name || 'Unnamed student'}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Create event
          </button>
        </div>
      </form>
    </Modal>
  )
}
