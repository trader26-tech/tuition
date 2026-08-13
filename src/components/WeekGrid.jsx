import { useMemo } from 'react'
import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isSameDay,
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns'

const KIND_COLORS = {
  tuition: 'bg-brand-500',
  meeting: 'bg-purple-500',
  exam: 'bg-red-500',
  other: 'bg-ink-400',
}

// Weekly timetable grid. Week starts Monday. Shows a fixed hour range and
// places each event as a block at its time. Clicking a block calls onSelect.
export default function WeekGrid({ anchor, events, onSelect, startHour = 7, endHour = 21 }) {
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const eventsThisWeek = useMemo(
    () =>
      events.filter((e) => {
        const d = new Date(e.starts_at)
        return d >= weekStart && d < weekEnd
      }),
    [events, weekStart, weekEnd]
  )

  // Widen the visible hour range so no event this week falls outside the grid.
  const [lo, hi] = useMemo(() => {
    let min = startHour
    let max = endHour
    for (const e of eventsThisWeek) {
      const s = getHours(new Date(e.starts_at))
      const en = e.ends_at ? getHours(new Date(e.ends_at)) : s + 1
      if (s < min) min = s
      if (en + 1 > max) max = Math.min(24, en + 1)
    }
    return [min, max]
  }, [eventsThisWeek, startHour, endHour])

  const hours = useMemo(
    () => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
    [lo, hi]
  )

  const rowH = 56 // px per hour
  const gridHeight = (hi - lo) * rowH

  const eventsForDay = (day) =>
    events.filter((e) => isSameDay(new Date(e.starts_at), day))

  const blockStyle = (e) => {
    const start = new Date(e.starts_at)
    const startMins = (getHours(start) - lo) * 60 + getMinutes(start)
    const end = e.ends_at ? new Date(e.ends_at) : null
    const durationMins = end ? Math.max(30, differenceInMinutes(end, start)) : 50
    return {
      top: (startMins / 60) * rowH,
      height: (durationMins / 60) * rowH,
    }
  }

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-ink-100">
          <div />
          {days.map((d) => {
            const today = isSameDay(d, new Date())
            return (
              <div key={d.toISOString()} className="border-l border-ink-100 px-2 py-2 text-center">
                <p className="text-xs font-medium uppercase text-ink-400">{format(d, 'EEE')}</p>
                <p
                  className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    today ? 'bg-brand-600 text-white' : 'text-ink-800'
                  }`}
                >
                  {format(d, 'd')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Hour labels */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.slice(0, -1).map((h, i) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-ink-400"
                style={{ top: i * rowH }}
              >
                {format(new Date().setHours(h, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="relative border-l border-ink-100"
              style={{ height: gridHeight }}
            >
              {/* hour lines */}
              {hours.slice(1).map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-ink-100"
                  style={{ top: (i + 1) * rowH }}
                />
              ))}

              {/* event blocks */}
              {eventsForDay(day).map((e) => {
                const s = blockStyle(e)
                return (
                  <button
                    key={e.occurrence_id || e.id}
                    onClick={() => onSelect?.(e)}
                    className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-white shadow-sm ${
                      KIND_COLORS[e.kind] || KIND_COLORS.other
                    }`}
                    style={{ top: s.top, height: s.height }}
                    title={e.title}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">
                      {e.is_recurring ? '↻ ' : ''}{e.title}
                    </p>
                    <p className="truncate text-[10px] opacity-90">
                      {format(new Date(e.starts_at), 'h:mm a')}
                    </p>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { addWeeks }
