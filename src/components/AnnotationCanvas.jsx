import { useRef, useState, useCallback } from 'react'

// One document page with an SVG annotation overlay.
// Annotations are stored in normalized [0..1] coordinates so they scale with
// the rendered size and survive zoom / re-render.
//
// annotation shapes:
//   { id, page, type: 'path',  color, width, points: [{x,y}, ...] }
//   { id, page, type: 'text',  color, x, y, text }
//   { id, page, type: 'stamp', color, x, y, symbol: '✓' | '✗' }

let idCounter = 0
const nextId = () => `a${Date.now()}_${idCounter++}`

export default function AnnotationCanvas({
  pageIndex,
  imageSrc,
  width,
  height,
  annotations,
  onChange,
  tool, // 'pen' | 'text' | 'tick' | 'cross' | 'erase' | 'none'
  color,
  penWidth,
  readOnly,
}) {
  const wrapRef = useRef(null)
  const [draft, setDraft] = useState(null) // in-progress path

  const pageAnnos = annotations.filter((a) => a.page === pageIndex)

  const toNorm = useCallback((e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const startDraw = (e) => {
    if (readOnly || tool === 'none') return
    const p = toNorm(e)

    if (tool === 'pen') {
      e.preventDefault()
      setDraft({ id: nextId(), page: pageIndex, type: 'path', color, width: penWidth, points: [p] })
    } else if (tool === 'tick' || tool === 'cross') {
      onChange([
        ...annotations,
        { id: nextId(), page: pageIndex, type: 'stamp', color, x: p.x, y: p.y, symbol: tool === 'tick' ? '✓' : '✗' },
      ])
    } else if (tool === 'text') {
      const text = window.prompt('Note text:')
      if (text && text.trim()) {
        onChange([
          ...annotations,
          { id: nextId(), page: pageIndex, type: 'text', color, x: p.x, y: p.y, text: text.trim() },
        ])
      }
    }
  }

  const moveDraw = (e) => {
    if (!draft) return
    e.preventDefault()
    const p = toNorm(e)
    setDraft((d) => ({ ...d, points: [...d.points, p] }))
  }

  const endDraw = () => {
    if (draft && draft.points.length > 1) {
      onChange([...annotations, draft])
    }
    setDraft(null)
  }

  const eraseAt = (annoId) => {
    if (readOnly || tool !== 'erase') return
    onChange(annotations.filter((a) => a.id !== annoId))
  }

  const pathD = (pts) =>
    pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x * width} ${pt.y * height}`).join(' ')

  const cursor =
    readOnly || tool === 'none'
      ? 'default'
      : tool === 'erase'
      ? 'pointer'
      : 'crosshair'

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto select-none bg-white shadow-card"
      style={{ width, maxWidth: '100%' }}
    >
      <img
        src={imageSrc}
        alt={`Page ${pageIndex + 1}`}
        className="block w-full"
        draggable={false}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ cursor, touchAction: tool === 'pen' ? 'none' : 'auto' }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      >
        {pageAnnos.map((a) => {
          if (a.type === 'path')
            return (
              <path
                key={a.id}
                d={pathD(a.points)}
                fill="none"
                stroke={a.color}
                strokeWidth={a.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                onMouseDown={() => eraseAt(a.id)}
                style={{ pointerEvents: tool === 'erase' ? 'stroke' : 'none' }}
              />
            )
          if (a.type === 'stamp')
            return (
              <text
                key={a.id}
                x={a.x * width}
                y={a.y * height}
                fill={a.color}
                fontSize={Math.max(26, width * 0.045)}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                onMouseDown={() => eraseAt(a.id)}
                style={{ pointerEvents: tool === 'erase' ? 'all' : 'none' }}
              >
                {a.symbol}
              </text>
            )
          if (a.type === 'text')
            return (
              <g
                key={a.id}
                onMouseDown={() => eraseAt(a.id)}
                style={{ pointerEvents: tool === 'erase' ? 'all' : 'none' }}
              >
                <text
                  x={a.x * width}
                  y={a.y * height}
                  fill={a.color}
                  fontSize={Math.max(16, width * 0.022)}
                  fontWeight="600"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {a.text}
                </text>
              </g>
            )
          return null
        })}

        {draft && (
          <path
            d={pathD(draft.points)}
            fill="none"
            stroke={draft.color}
            strokeWidth={draft.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute left-2 top-2 rounded bg-ink-900/60 px-2 py-0.5 text-xs font-medium text-white">
        Page {pageIndex + 1}
      </div>
    </div>
  )
}
