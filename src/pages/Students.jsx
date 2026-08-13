import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { Icon } from '../components/icons'
import { Spinner, Badge, Modal, EmptyState } from '../components/ui'

export default function Students() {
  const [tab, setTab] = useState('students') // 'students' | 'groups'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Students</h1>
        <p className="mt-1 text-sm text-ink-500">
          Manage each student's class and school, and organise them into groups.
        </p>
      </div>

      <div className="flex w-fit rounded-lg border border-ink-200 bg-white p-0.5 text-sm">
        {[
          { v: 'students', label: 'All students' },
          { v: 'groups', label: 'Groups' },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setTab(o.v)}
            className={`rounded-md px-4 py-1.5 font-medium transition ${
              tab === o.v ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tab === 'students' ? <StudentsTab /> : <GroupsTab />}
    </div>
  )
}

/* ─────────────── Students tab ─────────────── */
function StudentsTab() {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setStudents((await api.get('/users/students')) || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) =>
      [s.full_name, s.grade, s.school].some((v) => (v || '').toLowerCase().includes(q))
    )
  }, [students, query])

  if (loading)
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    )

  if (students.length === 0)
    return (
      <EmptyState icon={<Icon.Users width={22} />} title="No students yet">
        When students sign up (choosing “Student”), they'll appear here and you can set
        their class and school.
      </EmptyState>
    )

  return (
    <div className="space-y-4">
      <input
        className="input max-w-xs"
        placeholder="Search by name, class or school…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.5fr_1fr_1.5fr_auto] gap-4 border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 sm:grid">
          <span>Name</span>
          <span>Class</span>
          <span>School</span>
          <span></span>
        </div>
        <div className="divide-y divide-ink-100">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1.5fr_1fr_1.5fr_auto] sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {(s.full_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-medium text-ink-800">{s.full_name}</span>
              </div>
              <div>{s.grade ? <Badge tone="blue">{s.grade}</Badge> : <span className="text-sm text-ink-400">—</span>}</div>
              <div className="text-sm text-ink-600">{s.school || <span className="text-ink-400">—</span>}</div>
              <div className="sm:text-right">
                <button className="btn-secondary" onClick={() => setEditing(s)}>
                  <Icon.Pen width={15} /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <EditStudentModal
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </div>
  )
}

function EditStudentModal({ student, onClose, onSaved }) {
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setGrade(student?.grade || '')
    setSchool(student?.school || '')
    setError('')
  }, [student])

  if (!student) return null

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.patch(`/users/students/${student.id}`, { grade, school })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!student} onClose={onClose} title={`Edit ${student.full_name}`}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Class</label>
          <input
            className="input"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. Class 10"
          />
        </div>
        <div>
          <label className="label">School</label>
          <input
            className="input"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. St. Mary's High School"
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ─────────────── Groups tab ─────────────── */
function GroupsTab() {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [students, setStudents] = useState([])
  const [editing, setEditing] = useState(null) // group object or 'new'

  const load = async () => {
    setLoading(true)
    try {
      const [g, s] = await Promise.all([api.get('/groups'), api.get('/users/students')])
      setGroups(g || [])
      setStudents(s || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const del = async (id) => {
    if (!confirm('Delete this group? (Students are not deleted.)')) return
    await api.del(`/groups/${id}`)
    load()
  }

  if (loading)
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Icon.Plus width={18} /> New group
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Icon.Users width={22} />}
          title="No groups yet"
          action={
            <button className="btn-primary mt-2" onClick={() => setEditing('new')}>
              <Icon.Plus width={18} /> Create a group
            </button>
          }
        >
          Group students (for example by class or school) so you can send an assignment to
          the whole group at once.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-ink-900">{g.name}</h3>
                  <p className="text-xs text-ink-400">
                    {g.members.length} student{g.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button className="btn-ghost px-2" onClick={() => setEditing(g)} aria-label="Edit">
                    <Icon.Pen width={16} />
                  </button>
                  <button
                    className="btn-ghost px-2 text-ink-400 hover:text-red-600"
                    onClick={() => del(g.id)}
                    aria-label="Delete"
                  >
                    <Icon.Trash width={16} />
                  </button>
                </div>
              </div>
              {g.members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.members.map((m) => (
                    <span key={m.id} className="badge bg-ink-100 text-ink-600">
                      {m.full_name}
                      {m.grade ? ` · ${m.grade}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <GroupModal
        group={editing}
        students={students}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </div>
  )
}

function GroupModal({ group, students, onClose, onSaved }) {
  const isNew = group === 'new'
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (group === 'new') {
      setName('')
      setSelected(new Set())
    } else if (group) {
      setName(group.name)
      setSelected(new Set(group.members.map((m) => m.id)))
    }
    setError('')
  }, [group])

  if (!group) return null

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please give the group a name.')
    setBusy(true)
    setError('')
    try {
      const studentIds = [...selected]
      if (isNew) await api.post('/groups', { name, studentIds })
      else await api.patch(`/groups/${group.id}`, { name, studentIds })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!group} onClose={onClose} title={isNew ? 'New group' : 'Edit group'} size="lg">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Group name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Class 10 — St. Mary's"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Members</label>
          {students.length === 0 ? (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-400">
              No students have signed up yet.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="font-medium text-ink-800">{s.full_name}</span>
                  {(s.grade || s.school) && (
                    <span className="text-xs text-ink-400">
                      {[s.grade, s.school].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-ink-400">{selected.size} selected</p>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} {isNew ? 'Create group' : 'Save group'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
