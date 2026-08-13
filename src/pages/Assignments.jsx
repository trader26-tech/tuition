import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/icons'
import { Spinner, Badge, Modal, EmptyState } from '../components/ui'
import { dueLabel, relative, toLocalInput } from '../lib/format'

export default function Assignments() {
  const { isTeacher, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState([])
  const [subsByAssignment, setSubsByAssignment] = useState({})
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [assignments, summary] = await Promise.all([
        api.get('/assignments'),
        api.get('/submissions/summary'),
      ])

      const map = {}
      ;(summary.all || []).forEach((s) => {
        map[s.assignment_id] = map[s.assignment_id] || { total: 0, graded: 0, mine: null }
        map[s.assignment_id].total += 1
        if (s.status === 'graded') map[s.assignment_id].graded += 1
      })
      ;(summary.mine || []).forEach((s) => {
        map[s.assignment_id] = map[s.assignment_id] || { total: 0, graded: 0, mine: null }
        map[s.assignment_id].mine = s.status
      })

      setAssignments(assignments || [])
      setSubsByAssignment(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Assignments</h1>
          <p className="mt-1 text-sm text-ink-500">
            {isTeacher
              ? 'Post assignments and grade what students submit.'
              : 'Upload your answers and see your grades.'}
          </p>
        </div>
        {isTeacher && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Icon.Plus width={18} /> New assignment
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<Icon.Book width={22} />}
          title="No assignments yet"
          action={
            isTeacher ? (
              <button className="btn-primary mt-2" onClick={() => setShowCreate(true)}>
                <Icon.Plus width={18} /> Create your first assignment
              </button>
            ) : null
          }
        >
          {isTeacher
            ? 'Create an assignment and your students can start uploading their answers.'
            : 'When your teacher posts an assignment, it will appear here.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => {
            const due = dueLabel(a.due_date)
            const stat = subsByAssignment[a.id]
            return (
              <Link
                key={a.id}
                to={`/assignments/${a.id}`}
                className="card group flex flex-col p-5 transition hover:shadow-pop"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon.File width={20} />
                  </div>
                  <Badge tone={due.tone}>{due.text}</Badge>
                </div>
                <h3 className="font-semibold text-ink-900 group-hover:text-brand-700">
                  {a.title}
                </h3>
                {a.subject && (
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-brand-500">
                    {a.subject}
                  </p>
                )}
                {a.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-500">{a.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-400">
                  <span>added {relative(a.created_at)}</span>
                  {isTeacher ? (
                    <span className="font-medium text-ink-600">
                      {stat ? `${stat.graded}/${stat.total} graded` : '0 submissions'}
                    </span>
                  ) : stat?.mine ? (
                    <Badge tone={stat.mine === 'graded' ? 'green' : 'blue'}>
                      {stat.mine === 'graded' ? 'Graded' : 'Submitted'}
                    </Badge>
                  ) : (
                    <Badge tone="amber">Not submitted</Badge>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <CreateAssignmentModal
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

function CreateAssignmentModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    description: '',
    due_date: toLocalInput(),
    max_score: 100,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/assignments', {
        title: form.title,
        subject: form.subject,
        description: form.description,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        max_score: form.max_score,
      })
      setForm({ title: '', subject: '', description: '', due_date: toLocalInput(), max_score: 100 })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New assignment">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Algebra — Chapter 4 Exercises" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={set('subject')} placeholder="e.g. Maths" />
          </div>
          <div>
            <label className="label">Max score</label>
            <input className="input" type="number" min="1" value={form.max_score} onChange={set('max_score')} />
          </div>
        </div>
        <div>
          <label className="label">Due date</label>
          <input className="input" type="datetime-local" value={form.due_date} onChange={set('due_date')} />
        </div>
        <div>
          <label className="label">Instructions (optional)</label>
          <textarea className="input min-h-[90px]" value={form.description} onChange={set('description')} placeholder="What should students do? Any notes…" />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Create assignment
          </button>
        </div>
      </form>
    </Modal>
  )
}
