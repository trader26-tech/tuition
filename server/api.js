import express from 'express'
import multer from 'multer'
import { db, BUCKET } from './db.js'
import { requireAuth, requireTeacher } from './auth.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

// Everything below requires a signed-in user.
router.use(requireAuth)

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error('[api]', e)
    res.status(500).json({ error: e.message || 'Server error' })
  })

/* ─────────────── USERS ─────────────── */
// List students (teacher only) — used by the schedule attendee picker.
router.get('/users/students', requireTeacher, wrap(async (_req, res) => {
  const { data } = await db
    .from('app_users')
    .select('id, full_name')
    .eq('role', 'student')
    .order('full_name')
  res.json(data || [])
}))

/* ─────────────── ASSIGNMENTS ─────────────── */
router.get('/assignments', wrap(async (_req, res) => {
  const { data } = await db
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })
  res.json(data || [])
}))

router.get('/assignments/:id', wrap(async (req, res) => {
  const { data } = await db.from('assignments').select('*').eq('id', req.params.id).maybeSingle()
  if (!data) return res.status(404).json({ error: 'Assignment not found.' })
  res.json(data)
}))

router.post('/assignments', requireTeacher, wrap(async (req, res) => {
  const { title, subject, description, due_date, max_score } = req.body || {}
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })
  const { data, error } = await db
    .from('assignments')
    .insert({
      title: title.trim(),
      subject: (subject || '').trim(),
      description: (description || '').trim(),
      due_date: due_date || null,
      max_score: Number(max_score) || 100,
      created_by: req.user.id,
    })
    .select()
    .single()
  if (error) throw error
  res.json(data)
}))

router.delete('/assignments/:id', requireTeacher, wrap(async (req, res) => {
  // Remove stored files for this assignment's submissions first.
  const { data: subs } = await db
    .from('submissions')
    .select('file_path')
    .eq('assignment_id', req.params.id)
  const paths = (subs || []).map((s) => s.file_path).filter(Boolean)
  if (paths.length) await db.storage.from(BUCKET).remove(paths)
  await db.from('assignments').delete().eq('id', req.params.id)
  res.json({ ok: true })
}))

/* ─────────────── SUBMISSIONS ─────────────── */
// List submissions for an assignment. Teacher: all. Student: only their own.
router.get('/assignments/:id/submissions', wrap(async (req, res) => {
  let q = db
    .from('submissions')
    .select('*, student:student_id(id, full_name)')
    .eq('assignment_id', req.params.id)
    .order('submitted_at', { ascending: false })
  if (req.user.role !== 'teacher') q = q.eq('student_id', req.user.id)
  const { data } = await q
  res.json(data || [])
}))

// Counts + the current student's own status, for list/dashboard views.
router.get('/submissions/summary', wrap(async (req, res) => {
  const { data } = await db.from('submissions').select('assignment_id, student_id, status, score')
  const all = data || []
  const mine = all.filter((s) => s.student_id === req.user.id)
  res.json({ all: req.user.role === 'teacher' ? all : mine, mine })
}))

// Single submission (for grading / viewing). Students can only get their own.
router.get('/submissions/:id', wrap(async (req, res) => {
  const { data } = await db
    .from('submissions')
    .select('*, student:student_id(id, full_name)')
    .eq('id', req.params.id)
    .maybeSingle()
  if (!data) return res.status(404).json({ error: 'Submission not found.' })
  if (req.user.role !== 'teacher' && data.student_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed.' })
  res.json(data)
}))

// Student uploads / replaces their answer file for an assignment.
router.post('/assignments/:id/submit', upload.single('file'), wrap(async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Only students upload answers.' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

  const assignmentId = req.params.id
  const safeName = req.file.originalname.replace(/[^\w.\-]+/g, '_')
  const path = `${req.user.id}/${assignmentId}/${Date.now()}_${safeName}`

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
  if (upErr) throw upErr

  // Remove old file if replacing an existing submission.
  const { data: prev } = await db
    .from('submissions')
    .select('file_path')
    .eq('assignment_id', assignmentId)
    .eq('student_id', req.user.id)
    .maybeSingle()
  if (prev?.file_path && prev.file_path !== path) {
    await db.storage.from(BUCKET).remove([prev.file_path]).catch(() => {})
  }

  const { data, error } = await db
    .from('submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: req.user.id,
        file_path: path,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single()
  if (error) throw error
  res.json(data)
}))

// Teacher grades / annotates a submission.
router.patch('/submissions/:id', requireTeacher, wrap(async (req, res) => {
  const { annotations, feedback, score, markGraded } = req.body || {}
  const patch = {
    annotations: Array.isArray(annotations) ? annotations : [],
    feedback: feedback || '',
    score: score === '' || score == null ? null : Number(score),
  }
  if (markGraded) {
    patch.status = 'graded'
    patch.graded_at = new Date().toISOString()
  }
  const { data, error } = await db
    .from('submissions')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
}))

// A short-lived signed URL to view a submission's file.
router.get('/submissions/:id/file-url', wrap(async (req, res) => {
  const { data: sub } = await db
    .from('submissions')
    .select('file_path, student_id')
    .eq('id', req.params.id)
    .maybeSingle()
  if (!sub) return res.status(404).json({ error: 'Not found.' })
  if (req.user.role !== 'teacher' && sub.student_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed.' })
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(sub.file_path, 3600)
  if (error) throw error
  res.json({ url: data.signedUrl })
}))

/* ─────────────── SCHEDULE ─────────────── */
router.get('/schedule', wrap(async (req, res) => {
  const { data: events } = await db
    .from('schedule_events')
    .select('*')
    .order('starts_at', { ascending: true })

  const { data: att } = await db
    .from('schedule_attendees')
    .select('event_id, student_id, student:student_id(full_name)')

  const byEvent = {}
  ;(att || []).forEach((a) => {
    byEvent[a.event_id] = byEvent[a.event_id] || []
    byEvent[a.event_id].push({ id: a.student_id, name: a.student?.full_name || 'Student' })
  })

  let list = events || []
  // Students only see events they attend.
  if (req.user.role !== 'teacher') {
    list = list.filter((e) => (byEvent[e.id] || []).some((s) => s.id === req.user.id))
  }
  res.json(list.map((e) => ({ ...e, attendees: byEvent[e.id] || [] })))
}))

router.post('/schedule', requireTeacher, wrap(async (req, res) => {
  const { title, kind, subject, location, notes, starts_at, ends_at, attendees } = req.body || {}
  if (!title?.trim() || !starts_at)
    return res.status(400).json({ error: 'Title and start time are required.' })

  const { data: event, error } = await db
    .from('schedule_events')
    .insert({
      title: title.trim(),
      kind: kind || 'tuition',
      subject: (subject || '').trim(),
      location: (location || '').trim(),
      notes: (notes || '').trim(),
      starts_at,
      ends_at: ends_at || null,
      created_by: req.user.id,
    })
    .select()
    .single()
  if (error) throw error

  if (Array.isArray(attendees) && attendees.length) {
    await db
      .from('schedule_attendees')
      .insert(attendees.map((sid) => ({ event_id: event.id, student_id: sid })))
  }
  res.json(event)
}))

router.delete('/schedule/:id', requireTeacher, wrap(async (req, res) => {
  await db.from('schedule_events').delete().eq('id', req.params.id)
  res.json({ ok: true })
}))

export default router
