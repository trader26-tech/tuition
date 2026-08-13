import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/icons'
import { Spinner, Badge, Modal, EmptyState } from '../components/ui'
import { fmtTime, toLocalInput } from '../lib/format'
import { format, isToday, isTomorrow, isPast, startOfWeek, endOfWeek, addWeeks, isSameWeek } from 'date-fns'
import WeekGrid from '../components/WeekGrid'

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
  const [view, setView] = useState('week') // 'week' | 'list'
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [selected, setSelected] = useState(null) // event opened from the grid

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
              { v: 'week', label: 'Week' },
              { v: 'list', label: 'List' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setView(o.v)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  view === o.v ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'
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

      {/* View-specific controls */}
      {view === 'week' ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button className="btn-secondary px-2" onClick={() => setWeekAnchor((d) => addWeeks(d, -1))} aria-label="Previous week">
              <Icon.ChevronLeft width={18} />
            </button>
            <button className="btn-secondary px-2 rotate-180" onClick={() => setWeekAnchor((d) => addWeeks(d, 1))} aria-label="Next week">
              <Icon.ChevronLeft width={18} />
            </button>
            {!isSameWeek(weekAnchor, new Date(), { weekStartsOn: 1 }) && (
              <button className="btn-ghost" onClick={() => setWeekAnchor(new Date())}>Today</button>
            )}
          </div>
          <p className="text-sm font-medium text-ink-600">
            {format(startOfWeek(weekAnchor, { weekStartsOn: 1 }), 'd MMM')} –{' '}
            {format(endOfWeek(weekAnchor, { weekStartsOn: 1 }), 'd MMM yyyy')}
          </p>
        </div>
      ) : (
        <div className="flex rounded-lg border border-ink-200 bg-white p-0.5 text-sm w-fit">
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
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : view === 'week' ? (
        <>
          {events.length === 0 && (
            <EmptyState icon={<Icon.Calendar width={22} />} title="No events yet">
              {isTeacher
                ? 'Add a tuition and it will appear on this weekly timetable.'
                : 'When your teacher schedules a session for you, it appears here.'}
            </EmptyState>
          )}
          <WeekGrid anchor={weekAnchor} events={events} onSelect={setSelected} />
          <div className="flex flex-wrap gap-3 text-xs text-ink-500">
            {Object.entries(KIND_META).map(([k, m]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.label}
              </span>
            ))}
          </div>
        </>
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
                  <EventCard key={e.occurrence_id || e.id} event={e} isTeacher={isTeacher} onDeleted={load} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event details popup (from clicking a grid block) */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone={(KIND_META[selected.kind] || KIND_META.other).tone}>
                {(KIND_META[selected.kind] || KIND_META.other).label}
              </Badge>
              {selected.is_recurring && <Badge tone="gray">↻ Repeats weekly</Badge>}
              <span className="text-ink-500">
                {format(new Date(selected.starts_at), 'EEE, d MMM · h:mm a')}
                {selected.ends_at ? ` – ${fmtTime(selected.ends_at)}` : ''}
              </span>
            </div>
            {selected.is_recurring && (
              <p className="text-xs text-ink-400">
                Deleting removes the whole repeating series.
              </p>
            )}
            {selected.location && <p><span className="font-medium">Location:</span> {selected.location}</p>}
            {selected.meet_link && (
              <a
                href={selected.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full sm:w-auto"
              >
                <Icon.Calendar width={16} /> Join meeting
              </a>
            )}
            {selected.groups?.length > 0 && (
              <p className="text-ink-500">
                <span className="font-medium text-ink-700">Groups: </span>
                {selected.groups.map((g) => g.name).join(', ')}
              </p>
            )}
            {selected.attendees?.length > 0 && (
              <p className="text-ink-500">
                <span className="font-medium text-ink-700">Students: </span>
                {selected.attendees.map((a) => a.name).join(', ')}
              </p>
            )}
            {isTeacher && (
              <div className="flex justify-end pt-2">
                <button
                  className="btn-danger"
                  onClick={async () => {
                    if (!confirm('Delete this event?')) return
                    await api.del(`/schedule/${selected.id}`)
                    setSelected(null)
                    load()
                  }}
                >
                  <Icon.Trash width={16} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

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
          {event.is_recurring && <Badge tone="gray">↻ Weekly</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          {event.location && <span>📍 {event.location}</span>}
          {event.meet_link && (
            <a href={event.meet_link} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
              🔗 Join meeting
            </a>
          )}
          {event.groups?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon.Users width={13} /> {event.groups.map((g) => g.name).join(', ')}
            </span>
          )}
        </div>
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

const WEEKDAYS = [
  { n: 1, l: 'Mon' }, { n: 2, l: 'Tue' }, { n: 3, l: 'Wed' },
  { n: 4, l: 'Thu' }, { n: 5, l: 'Fri' }, { n: 6, l: 'Sat' }, { n: 7, l: 'Sun' },
]

function CreateEventModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    kind: 'tuition',
    starts_at: toLocalInput(),
    ends_at: '',
    location: '',
    meet_link: '',
  })
  const [repeats, setRepeats] = useState(false)
  const [weekdays, setWeekdays] = useState(new Set()) // ISO 1..7
  const [groups, setGroups] = useState([])
  const [pickedGroups, setPickedGroups] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    api.get('/groups').then(setGroups).catch(() => setGroups([]))
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleWeekday = (n) =>
    setWeekdays((s) => {
      const next = new Set(s)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  const toggleGroup = (id) =>
    setPickedGroups((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const reset = () => {
    setForm({ title: '', kind: 'tuition', starts_at: toLocalInput(), ends_at: '', location: '', meet_link: '' })
    setRepeats(false)
    setWeekdays(new Set())
    setPickedGroups(new Set())
  }

  const submit = async (e) => {
    e.preventDefault()
    if (repeats && weekdays.size === 0)
      return setError('Pick at least one day to repeat on.')
    setBusy(true)
    setError('')
    try {
      await api.post('/schedule', {
        title: form.title,
        kind: form.kind,
        location: form.location,
        meet_link: form.meet_link,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        repeat_weekdays: repeats ? [...weekdays] : [],
        groupIds: [...pickedGroups],
      })
      reset()
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
            <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Physics tuition — Batch A" required autoFocus />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.kind} onChange={set('kind')}>
              {Object.entries(KIND_META).map(([v, m]) => (
                <option key={v} value={v}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="hidden sm:block" />
          <div>
            <label className="label">Start time</label>
            <input className="input" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
          </div>
          <div>
            <label className="label">End time</label>
            <input className="input" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={set('location')} placeholder="e.g. Room 2" />
          </div>
          <div>
            <label className="label">Meeting link</label>
            <input className="input" type="url" value={form.meet_link} onChange={set('meet_link')} placeholder="https://meet.google.com/…" />
          </div>
        </div>

        {/* Repeat weekly (days only — auto-rolls forward) */}
        <div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
            <input type="checkbox" className="accent-brand-600" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
            Repeat weekly
          </label>
          {repeats && (
            <div className="mt-2 rounded-lg border border-ink-200 p-3">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = weekdays.has(d.n)
                  return (
                    <button
                      type="button"
                      key={d.n}
                      onClick={() => toggleWeekday(d.n)}
                      className={`h-9 w-11 rounded-md text-sm font-medium transition ${
                        on ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                      }`}
                    >
                      {d.l}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Repeats on these days at the start time, filling the timetable ahead.
              </p>
            </div>
          )}
        </div>

        {/* Attendees — by group */}
        <div>
          <label className="label">Assign to groups</label>
          {groups.length === 0 ? (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-400">
              No groups yet. Create groups in the <b>Students → Groups</b> tab, then assign them here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => {
                const on = pickedGroups.has(g.id)
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`badge border transition ${
                      on
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                    }`}
                  >
                    {g.name} · {g.members.length}
                  </button>
                )
              })}
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
