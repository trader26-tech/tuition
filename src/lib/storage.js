import { supabase } from './supabase'

const BUCKET = 'submissions'

// Path convention enforced by storage RLS: <student_id>/<assignment_id>/<file>
export function buildPath(studentId, assignmentId, fileName) {
  const safe = fileName.replace(/[^\w.\-]+/g, '_')
  return `${studentId}/${assignmentId}/${Date.now()}_${safe}`
}

export async function uploadSubmissionFile(path, file) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  return { error }
}

// Signed URL for private files (valid for a limited time).
export async function getSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error) return { url: null, error }
  return { url: data.signedUrl, error: null }
}

export async function removeFile(path) {
  return supabase.storage.from(BUCKET).remove([path])
}
