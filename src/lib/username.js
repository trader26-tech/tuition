// Users sign in with just a NAME + password — no email, no confirmation.
// Supabase Auth still needs an email internally, so we deterministically map a
// login name to a hidden internal email. Users never see or type this.
//
// We use subdomains of example.com — an IANA-reserved domain that always passes
// Supabase's email validation but can never receive real mail. (A made-up TLD
// like ".local" is rejected as invalid, which is why we avoid it.)
//
// e.g.  "Priya Sharma" (student) -> "priya-sharma@student.example.com"
//       "Mom" (teacher)          -> "mom@teacher.example.com"

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
  const domain = role === 'teacher' ? 'teacher.example.com' : 'student.example.com'
  return `${slug}@${domain}`
}

// True if the string looks like a valid login name (has real characters).
export function isValidUsername(name) {
  return toUsername(name).length >= 2
}
