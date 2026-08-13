import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { renderPdfToImages } from '../lib/pdf'
import AnnotationCanvas from '../components/AnnotationCanvas'
import { Icon } from '../components/icons'
import { Spinner, Badge } from '../components/ui'
import { fmtDateTime } from '../lib/format'

const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#111827']

const TOOLS = [
  { key: 'pen', label: 'Pen', icon: Icon.Pen },
  { key: 'tick', label: 'Tick', icon: Icon.Check },
  { key: 'cross', label: 'Cross', render: () => <span className="text-base font-bold">✗</span> },
  { key: 'text', label: 'Note', icon: Icon.Text },
  { key: 'erase', label: 'Erase', icon: Icon.Eraser },
]

export default function GradePage() {
  const { id: assignmentId, submissionId } = useParams()
  const { isTeacher } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignment, setAssignment] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [student, setStudent] = useState(null)
  const [pages, setPages] = useState([]) // [{dataUrl,width,height}]

  const [annotations, setAnnotations] = useState([])
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [penWidth, setPenWidth] = useState(3)

  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const readOnly = !isTeacher

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [sub, asg] = await Promise.all([
          api.get(`/submissions/${submissionId}`),
          api.get(`/assignments/${assignmentId}`),
        ])
        if (!active) return
        if (!sub || !asg) throw new Error('Submission not found.')

        setSubmission(sub)
        setAssignment(asg)
        setAnnotations(Array.isArray(sub.annotations) ? sub.annotations : [])
        setScore(sub.score ?? '')
        setFeedback(sub.feedback ?? '')
        setStudent(sub.student || null)

        // Fetch the file (signed URL from our API) and render pages.
        const { url } = await api.get(`/submissions/${submissionId}/file-url`)
        if (!url) throw new Error('Could not load the file.')

        const isPdf =
          (sub.file_type || '').includes('pdf') ||
          sub.file_name?.toLowerCase().endsWith('.pdf')

        if (isPdf) {
          const res = await fetch(url)
          const buf = await res.arrayBuffer()
          const imgs = await renderPdfToImages(buf, 1.6)
          if (active) setPages(imgs)
        } else {
          // Image: measure natural size.
          const dims = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
            img.onerror = () => resolve({ width: 1000, height: 1400 })
            img.src = url
          })
          if (active) setPages([{ dataUrl: url, width: dims.width, height: dims.height }])
        }
      } catch (e) {
        if (active) setError(e.message || 'Failed to load.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [assignmentId, submissionId])

  const save = async (markGraded) => {
    setSaving(true)
    setError('')
    try {
      const updated = await api.patch(`/submissions/${submissionId}`, {
        annotations,
        feedback,
        score,
        markGraded,
      })
      setSavedAt(new Date())
      setSubmission((s) => ({ ...s, ...updated }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const maxScore = assignment?.max_score ?? 100

  const displayWidth = useMemo(() => 820, [])

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-brand-600">
        <Spinner className="h-7 w-7" />
        <p className="text-sm text-ink-500">Loading the document…</p>
      </div>
    )

  if (error && !submission)
    return (
      <div className="card p-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={`/assignments/${assignmentId}`} className="btn-secondary mt-4">
          Back to assignment
        </Link>
      </div>
    )

  return (
    <div className="space-y-4">
      <Link
        to={`/assignments/${assignmentId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-700"
      >
        <Icon.ChevronLeft width={16} /> Back to assignment
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{assignment?.title}</h1>
          <p className="text-sm text-ink-500">
            {student?.full_name || 'Student'} · {submission?.file_name}
          </p>
        </div>
        {submission?.status === 'graded' && <Badge tone="green">Graded</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Document + annotations */}
        <div className="space-y-6">
          {isTeacher && (
            <Toolbar
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              penWidth={penWidth}
              setPenWidth={setPenWidth}
              onClearPage={() => setAnnotations([])}
              hasAnnotations={annotations.length > 0}
            />
          )}

          <div className="space-y-6 overflow-x-auto rounded-xl bg-ink-100 p-4">
            {pages.map((pg, i) => (
              <AnnotationCanvas
                key={i}
                pageIndex={i}
                imageSrc={pg.dataUrl}
                width={displayWidth}
                height={(pg.height / pg.width) * displayWidth}
                annotations={annotations}
                onChange={setAnnotations}
                tool={isTeacher ? tool : 'none'}
                color={color}
                penWidth={penWidth}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>

        {/* Grading panel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold text-ink-900">
              {isTeacher ? 'Grade' : 'Your result'}
            </h2>

            <div>
              <label className="label">Score</label>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={maxScore}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  disabled={readOnly}
                  placeholder="—"
                />
                <span className="text-sm font-medium text-ink-500">/ {maxScore}</span>
              </div>
            </div>

            <div>
              <label className="label">Feedback</label>
              <textarea
                className="input min-h-[110px]"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={readOnly}
                placeholder={isTeacher ? 'Write feedback for the student…' : 'No feedback'}
              />
            </div>

            {isTeacher ? (
              <div className="space-y-2">
                <button className="btn-primary w-full" onClick={() => save(true)} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4" /> : <Icon.Check width={18} />}
                  Save & mark graded
                </button>
                <button className="btn-secondary w-full" onClick={() => save(false)} disabled={saving}>
                  Save draft
                </button>
                {savedAt && (
                  <p className="text-center text-xs text-emerald-600">
                    Saved {fmtDateTime(savedAt)}
                  </p>
                )}
                {error && <p className="text-center text-xs text-red-600">{error}</p>}
              </div>
            ) : (
              <p className="text-xs text-ink-400">
                Your teacher's marks appear on the document. Zoom your browser to see detail.
              </p>
            )}
          </div>

          {isTeacher && (
            <p className="mt-3 px-1 text-xs text-ink-400">
              Tip: pick a tool, then draw on the paper. Use <b>Erase</b> then click a mark to
              remove it. Marks are saved as a re-editable layer — the original file is never
              changed.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Toolbar({ tool, setTool, color, setColor, penWidth, setPenWidth, onClearPage, hasAnnotations }) {
  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => {
          const active = tool === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              title={t.label}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'
              }`}
            >
              {t.icon ? <t.icon width={17} /> : t.render()}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      <div className="h-6 w-px bg-ink-200" />

      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ring-2 ring-offset-2 transition ${
              color === c ? 'ring-ink-400' : 'ring-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="h-6 w-px bg-ink-200" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-500">Pen</span>
        <input
          type="range"
          min="1"
          max="8"
          value={penWidth}
          onChange={(e) => setPenWidth(Number(e.target.value))}
          className="w-20 accent-brand-600"
        />
      </div>

      <button
        onClick={onClearPage}
        disabled={!hasAnnotations}
        className="btn-ghost ml-auto text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        <Icon.Trash width={16} /> Clear all
      </button>
    </div>
  )
}
