import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'

export function fmtDate(d) {
  if (!d) return ''
  return format(new Date(d), 'd MMM yyyy')
}

export function fmtDateTime(d) {
  if (!d) return ''
  return format(new Date(d), 'd MMM yyyy, h:mm a')
}

export function fmtTime(d) {
  if (!d) return ''
  return format(new Date(d), 'h:mm a')
}

export function dueLabel(d) {
  if (!d) return { text: 'No due date', tone: 'gray' }
  const date = new Date(d)
  if (isToday(date)) return { text: 'Due today', tone: 'amber' }
  if (isTomorrow(date)) return { text: 'Due tomorrow', tone: 'amber' }
  if (isPast(date)) return { text: `Overdue · ${fmtDate(d)}`, tone: 'red' }
  return { text: `Due ${fmtDate(d)}`, tone: 'blue' }
}

export function relative(d) {
  if (!d) return ''
  return formatDistanceToNow(new Date(d), { addSuffix: true })
}

// Convert a Date to the value format expected by <input type="datetime-local">.
export function toLocalInput(d) {
  const date = d ? new Date(d) : new Date()
  const off = date.getTimezoneOffset()
  const local = new Date(date.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}
