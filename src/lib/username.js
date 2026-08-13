// Users sign in with just a NAME + password — no email, no confirmation.
// Supabase Auth still needs an email internally, so we deterministically map a
// login name to a hidden internal email. Users never see or type this.
//
// e.g.  "Priya Sharma" (student) -> "priya-sharma@students.tuition.local"
//       "Mom" (teacher)          -> "mom@teachers.tuition.local"

// Turn a display name into a URL/email-safe login slug.
export function toUsername(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // spaces & punctuation -> hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 40)
}

// Map a login name + role to the hidden internal email.
export function nameToEmail(name, role) {
  const slug = toUsername(name)
  const domain = role === 'teacher' ? 'teachers.tuition.local' : 'students.tuition.local'
  return `${slug}@${domain}`
}

// True if the string looks like a valid login name (has real characters).
export function isValidUsername(name) {
  return toUsername(name).length >= 2
}
