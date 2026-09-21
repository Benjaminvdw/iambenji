import { useEffect, useRef, useState } from 'react'

const CANVAS_W = 1200
const CANVAS_H = 700
const DRAG_HINT_AT = 4
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.25

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

function getBounds(bw, bh, z) {
  const cw = CANVAS_W * z
  const ch = CANVAS_H * z
  const minX = cw <= bw ? Math.round((bw - cw) / 2) : bw - cw
  const maxX = cw <= bw ? Math.round((bw - cw) / 2) : 0
  const minY = ch <= bh ? Math.round((bh - ch) / 2) : bh - ch
  const maxY = ch <= bh ? Math.round((bh - ch) / 2) : 0
  return { minX, maxX, minY, maxY }
}

export default function PostItBoard({ password }) {
  const [notes, setNotes] = useState([])
  const [status, setStatus] = useState('loading')
  const [fields, setFields] = useState({ name: '', message: '' })
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const boardRef = useRef(null)
  const dragOrigin = useRef(null)
  const noteBeingDragged = useRef(null) // { id, offsetX, offsetY, currentX, currentY }
  const state$ = useRef({ pan: { x: 0, y: 0 }, zoom: 1 })
  state$.current.pan = pan
  state$.current.zoom = zoom

  useEffect(() => {
    if (!boardRef.current) return
    const { clientWidth, clientHeight } = boardRef.current
    const fitZoom = clamp(
      Math.min(clientWidth / CANVAS_W, clientHeight / CANVAS_H),
      MIN_ZOOM,
      MAX_ZOOM,
    )
    const bounds = getBounds(clientWidth, clientHeight, fitZoom)
    const p = { x: bounds.minX, y: bounds.minY }
    state$.current = { zoom: fitZoom, pan: p }
    setZoom(fitZoom)
    setPan(p)
  }, [])

  useEffect(() => {
    fetch('/api/post-its')
      .then((r) => r.json())
      .then((data) => {
        setNotes(Array.isArray(data) ? data : [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const handler = (e) => {
      e.preventDefault()
      const rect = board.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { zoom: oldZoom, pan: oldPan } = state$.current
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      const newZoom = clamp(oldZoom + delta, MIN_ZOOM, MAX_ZOOM)
      if (newZoom === oldZoom) return
      const bounds = getBounds(board.clientWidth, board.clientHeight, newZoom)
      const newPan = {
        x: clamp(cx - (cx - oldPan.x) * (newZoom / oldZoom), bounds.minX, bounds.maxX),
        y: clamp(cy - (cy - oldPan.y) * (newZoom / oldZoom), bounds.minY, bounds.maxY),
      }
      state$.current = { zoom: newZoom, pan: newPan }
      setZoom(newZoom)
      setPan(newPan)
    }
    board.addEventListener('wheel', handler, { passive: false })
    return () => board.removeEventListener('wheel', handler)
  }, [])

  const handleChange = (e) => setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/post-its', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      const note = await res.json()
      setNotes((prev) => [...prev, note])
      setFields({ name: '', message: '' })
      setSubmitStatus('idle')
    } catch {
      setSubmitStatus('error')
    }
  }

  const handleNoteMouseDown = (e, note) => {
    if (!password) return
    e.stopPropagation()
    const rect = boardRef.current.getBoundingClientRect()
    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom
    noteBeingDragged.current = {
      id: note.id,
      offsetX: mouseCanvasX - (note.x / 100) * CANVAS_W,
      offsetY: mouseCanvasY - (note.y / 100) * CANVAS_H,
      currentX: note.x,
      currentY: note.y,
    }
  }

  const startDrag = (clientX, clientY) => {
    if (noteBeingDragged.current) return
    setDragging(true)
    dragOrigin.current = { x: clientX - pan.x, y: clientY - pan.y }
  }

  const moveDrag = (clientX, clientY) => {
    if (noteBeingDragged.current && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect()
      const mouseCanvasX = (clientX - rect.left - pan.x) / zoom
      const mouseCanvasY = (clientY - rect.top - pan.y) / zoom
      const newX = clamp((mouseCanvasX - noteBeingDragged.current.offsetX) / CANVAS_W * 100, 0, 92)
      const newY = clamp((mouseCanvasY - noteBeingDragged.current.offsetY) / CANVAS_H * 100, 0, 90)
      noteBeingDragged.current.currentX = newX
      noteBeingDragged.current.currentY = newY
      const id = noteBeingDragged.current.id
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, x: newX, y: newY } : n))
      return
    }
    if (!dragging || !dragOrigin.current || !boardRef.current) return
    const { clientWidth, clientHeight } = boardRef.current
    const { minX, maxX, minY, maxY } = getBounds(clientWidth, clientHeight, zoom)
    const newPan = {
      x: clamp(clientX - dragOrigin.current.x, minX, maxX),
      y: clamp(clientY - dragOrigin.current.y, minY, maxY),
    }
    state$.current.pan = newPan
    setPan(newPan)
  }

  const endDrag = () => {
    if (noteBeingDragged.current) {
      const { id, currentX, currentY } = noteBeingDragged.current
      fetch('/api/post-its', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({ id, x: currentX, y: currentY }),
      }).catch(() => {})
      noteBeingDragged.current = null
      return
    }
    setDragging(false)
    dragOrigin.current = null
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    moveDrag(e.touches[0].clientX, e.touches[0].clientY)
  }

  const zoomBy = (delta) => {
    const board = boardRef.current
    if (!board) return
    const { zoom: oldZoom, pan: oldPan } = state$.current
    const newZoom = clamp(oldZoom + delta, MIN_ZOOM, MAX_ZOOM)
    if (newZoom === oldZoom) return
    const bounds = getBounds(board.clientWidth, board.clientHeight, newZoom)
    const cx = board.clientWidth / 2
    const cy = board.clientHeight / 2
    const newPan = {
      x: clamp(cx - (cx - oldPan.x) * (newZoom / oldZoom), bounds.minX, bounds.maxX),
      y: clamp(cy - (cy - oldPan.y) * (newZoom / oldZoom), bounds.minY, bounds.maxY),
    }
    state$.current = { zoom: newZoom, pan: newPan }
    setZoom(newZoom)
    setPan(newPan)
  }

  const bw = boardRef.current?.clientWidth ?? 0
  const bh = boardRef.current?.clientHeight ?? 0
  const bounds = getBounds(bw, bh, zoom)
  const edgeLeft = pan.x < -1
  const edgeRight = bw > 0 && pan.x > bounds.minX + 1
  const edgeTop = pan.y < -1
  const edgeBottom = bh > 0 && pan.y > bounds.minY + 1

  return (
    <div className="postit-section">
      <div
        className={`postit-board${dragging ? ' is-dragging' : ''}${password ? ' admin-mode' : ''}`}
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseLeave={endDrag}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onTouchEnd={endDrag}
        onTouchMove={onTouchMove}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        ref={boardRef}
      >
        {status === 'loading' && <p className="postit-status">loading notes...</p>}
        {status === 'error' && <p className="postit-status">could not load notes</p>}
        {status === 'ready' && notes.length === 0 && (
          <p className="postit-status">no notes yet — be the first</p>
        )}

        <div
          className="postit-canvas"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {notes.map((note) => (
            <div
              className="postit"
              key={note.id}
              onMouseDown={(e) => handleNoteMouseDown(e, note)}
              style={{
                background: note.color,
                left: `${note.x}%`,
                top: `${note.y}%`,
                transform: `rotate(${note.rotation}deg)`,
              }}
            >
              <p className="postit-message">{note.message}</p>
              <span className="postit-name">— {note.name}</span>
            </div>
          ))}
        </div>

        <div className={`postit-edge postit-edge-left${edgeLeft ? ' visible' : ''}`} />
        <div className={`postit-edge postit-edge-right${edgeRight ? ' visible' : ''}`} />
        <div className={`postit-edge postit-edge-top${edgeTop ? ' visible' : ''}`} />
        <div className={`postit-edge postit-edge-bottom${edgeBottom ? ' visible' : ''}`} />

        <div
          className="postit-zoom-controls"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            className="postit-zoom-btn"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomBy(-ZOOM_STEP)}
            type="button"
          >−</button>
          <span className="postit-zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            className="postit-zoom-btn"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomBy(ZOOM_STEP)}
            type="button"
          >+</button>
        </div>

        {password && (
          <p className="postit-admin-hint">drag notes to move</p>
        )}
        {!password && notes.length >= DRAG_HINT_AT && (
          <p className="postit-drag-hint">drag · scroll to zoom</p>
        )}
      </div>

      {!password && (
        <form className="postit-form" onSubmit={handleSubmit}>
          <p className="small-label">pin a note</p>
          <div className="postit-form-row">
            <input
              maxLength={30}
              name="name"
              onChange={handleChange}
              placeholder="your name"
              required
              type="text"
              value={fields.name}
            />
            <button disabled={submitStatus === 'sending'} type="submit">
              {submitStatus === 'sending' ? 'pinning...' : 'pin it'}
            </button>
          </div>
          <textarea
            maxLength={180}
            name="message"
            onChange={handleChange}
            placeholder="leave a note..."
            required
            rows={3}
            value={fields.message}
          />
          {submitStatus === 'error' && <p className="postit-form-error">something went wrong</p>}
        </form>
      )}
    </div>
  )
}
