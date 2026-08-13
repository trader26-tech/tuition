import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/icons'
import { Spinner, Badge, EmptyState } from '../components/ui'
import { dueLabel, fmtDateTime, relative } from '../lib/format'

const ACCEPT = '.pdf,image/*'

export default function AssignmentDetail() {
  const { id } = useParams()
  const { isTeacher, user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState(null)
  const [submissions, setSubmissions] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const [a, subs] = await Promise.all([
        api.get(`/assignments/${id}`),
        api.get(`/assignments/${id}/submissions`),
      ])
      setAssignment(a)
      setSubmissions(subs || [])
    } catch {
      setAssignment(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading)
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    )

  if (!assignment)
    return (
      <EmptyState icon={<Icon.File width={22} />} title="Assignment not found">
        It may have been removed. <Link className="text-brand-600" to="/assignments">Back to assignments</Link>
      </EmptyState>
    )

  const due = dueLabel(assignment.due_date)
  const mySubmission = submissions.find((s) => s.student_id === user?.id)

  return (
    <div className="space-y-6">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-700">
        <Icon.ChevronLeft width={16} /> Assignments
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {assignment.subject && (
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                  {assignment.subject}
                </span>
              )}
              <Badge tone={due.tone}>{due.text}</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-ink-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-ink-400">
              Max score {assignment.max_score} · added {relative(assignment.created_at)}
            </p>
          </div>
          {isTeacher && (
            <DeleteAssignmentButton id={assignment.id} onDeleted={() => navigate('/assignments')} />
          )}
        </div>
        {assignment.description && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-ink-50 p-4 text-sm text-ink-700">
            {assignment.description}
          </p>
        )}
        {assignment.attachment_path && (
          <AttachmentCard assignment={assignment} />
        )}
      </div>

      {isTeacher ? (
        <TeacherSubmissions assignment={assignment} submissions={submissions} />
      ) : (
        <StudentSubmission assignment={assignment} submission={mySubmission} onChanged={load} />
      )}
    </div>
  )
}

function AttachmentCard({ assignment }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = async () => {
    setBusy(true)
    setError('')
    try {
      const { url } = await api.get(`/assignments/${assignment.id}/attachment-url`)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600">
        <Icon.File width={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800">
          {assignment.attachment_name || 'Question paper'}
        </p>
        <p className="text-xs text-ink-400">Attached by the teacher</p>
      </div>
      <button className="btn-secondary" onClick={open} disabled={busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <Icon.Download width={16} />}
        Open
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function DeleteAssignmentButton({ id, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const del = async () => {
    if (!confirm('Delete this assignment and all its submissions? This cannot be undone.')) return
    setBusy(true)
    await api.del(`/assignments/${id}`)
    onDeleted()
  }
  return (
    <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={del} disabled={busy}>
      {busy ? <Spinner className="h-4 w-4" /> : <Icon.Trash width={18} />} Delete
    </button>
  )
}

/* ─────────────── Teacher: list of all submissions ─────────────── */
function TeacherSubmissions({ assignment, submissions }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">
          Submissions <span className="text-ink-400">({submissions.length})</span>
        </h2>
      </div>
      {submissions.length === 0 ? (
        <EmptyState icon={<Icon.Upload width={22} />} title="No submissions yet">
          When students upload their answers, they'll show up here ready to grade.
        </EmptyState>
      ) : (
        <div className="card divide-y divide-ink-100">
          {submissions.map((s) => {
            const name = s.student?.full_name || 'Student'
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-800">{name}</p>
                  <p className="truncate text-xs text-ink-400">
                    {s.file_name} · submitted {relative(s.submitted_at)}
                  </p>
                </div>
                {s.status === 'graded' ? (
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">
                      {s.score}
                      <span className="text-sm font-normal text-ink-400">/{assignment.max_score}</span>
                    </p>
                    <Badge tone="green">Graded</Badge>
                  </div>
                ) : (
                  <Badge tone="amber">Needs grading</Badge>
                )}
                <Link to={`/assignments/${assignment.id}/grade/${s.id}`} className="btn-primary">
                  <Icon.Pen width={16} />
                  {s.status === 'graded' ? 'Review' : 'Grade'}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────── Student: upload / view own submission ─────────────── */
function StudentSubmission({ assignment, submission, onChanged }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const isGraded = submission?.status === 'graded'

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.upload(`/assignments/${assignment.id}/submit`, fd)
      onChanged()
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-ink-900">Your submission</h2>

      {submission && (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon.File width={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink-800">{submission.file_name}</p>
              <p className="text-xs text-ink-400">submitted {fmtDateTime(submission.submitted_at)}</p>
            </div>
            <Badge tone={isGraded ? 'green' : 'blue'}>{isGraded ? 'Graded' : 'Submitted'}</Badge>
          </div>

          {isGraded && (
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">Your score</span>
                <span className="text-2xl font-bold text-emerald-700">
                  {submission.score}
                  <span className="text-base font-normal text-emerald-500">/{assignment.max_score}</span>
                </span>
              </div>
              {submission.feedback && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">
                  <span className="font-semibold">Feedback: </span>
                  {submission.feedback}
                </p>
              )}
              <Link to={`/assignments/${assignment.id}/grade/${submission.id}`} className="btn-secondary mt-3">
                <Icon.Pen width={16} /> View marked paper
              </Link>
            </div>
          )}
        </div>
      )}

      {!isGraded && (
        <div className="card p-5">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-10 text-center transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
          >
            {uploading ? (
              <Spinner className="h-6 w-6 text-brand-600" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon.Upload width={24} />
              </div>
            )}
            <span className="text-sm font-medium text-ink-700">
              {uploading ? 'Uploading…' : submission ? 'Replace your answer file' : 'Upload your answer (PDF or photo)'}
            </span>
            <span className="text-xs text-ink-400">PDF, JPG or PNG · one file</span>
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {isGraded && (
        <p className="text-center text-xs text-ink-400">
          This assignment has been graded, so it's locked. Ask your teacher if you need to resubmit.
        </p>
      )}
    </div>
  )
}
