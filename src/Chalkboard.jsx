import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Fireflies from './Fireflies'
import whiteCrayonUrl from './assets/blinkies/crayons/white_crayon.png'
import pinkCrayonUrl  from './assets/blinkies/crayons/pink_crayon.png'
import grenCrayonUrl  from './assets/blinkies/crayons/gren_crayon.png'
import blueCrayonUrl  from './assets/blinkies/crayons/blue_crayon.png'

const WORLD_W = 16000
const WORLD_H = 9000
const SK_W = 800
const SK_H = 450
const BRUSH_SIZES = [3, 7, 14, 24]
const MIN_DIST = 3
const MIN_SCALE = 0.1
const MAX_SCALE = 4
const MM_W = 160
const MM_H = 90

const CRAYONS = [
  { key: 'white', img: whiteCrayonUrl, colors: { main: '#e2edcc', spine: '#f4fae8', grain: ['#d8e8bc', '#98a878'] } },
  { key: 'pink',  img: pinkCrayonUrl,  colors: { main: '#f0b8cc', spine: '#fce8f0', grain: ['#e8a8c0', '#c07090'] } },
  { key: 'gren',  img: grenCrayonUrl,  colors: { main: '#a8e0b8', spine: '#d0f5dc', grain: ['#90d0a0', '#50906a'] } },
  { key: 'blue',  img: blueCrayonUrl,  colors: { main: '#98b8e8', spine: '#d0e0f8', grain: ['#88a8d8', '#4870a8'] } },
]

function getCrayonColors(colorKey) {
  return CRAYONS.find((c) => c.key === colorKey)?.colors ?? CRAYONS[0].colors
}

function snapTo(v, grid) { return Math.round(v / grid) * grid }

function drawCrayon(ctx, points, size, colors) {
  if (points.length < 2) return
  const { main, spine, grain } = colors
  const g = Math.max(1, Math.floor(size / 5))
  const sn = (v) => snapTo(v, g)
  const tracePath = () => {
    ctx.beginPath()
    ctx.moveTo(sn(points[0][0]), sn(points[0][1]))
    for (let i = 1; i < points.length; i++) ctx.lineTo(sn(points[i][0]), sn(points[i][1]))
  }
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.82; ctx.strokeStyle = main; ctx.lineWidth = size
  tracePath(); ctx.stroke()
  ctx.globalAlpha = 0.28; ctx.strokeStyle = spine; ctx.lineWidth = Math.max(1, size * 0.22)
  tracePath(); ctx.stroke()
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]; const [x1, y1] = points[i + 1]
    const dx = x1 - x0; const dy = y1 - y0
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.round(dist / 2))
    for (let s = 0; s < steps; s++) {
      const t = s / steps; const bx = x0 + dx * t; const by = y0 + dy * t
      const dots = Math.ceil(size * 0.55)
      for (let d = 0; d < dots; d++) {
        const angle = Math.random() * Math.PI * 2; const r = Math.random() * size * 0.52
        ctx.globalAlpha = Math.random() * 0.38 + 0.04
        ctx.fillStyle = Math.random() > 0.45 ? grain[0] : grain[1]
        ctx.fillRect(sn(bx + Math.cos(angle) * r), sn(by + Math.sin(angle) * r), g, g)
      }
    }
  }
  ctx.restore()
}

function simplify(pts) {
  if (pts.length <= 2) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1]
    const dx = pts[i][0] - prev[0]; const dy = pts[i][1] - prev[1]
    if (dx * dx + dy * dy >= MIN_DIST * MIN_DIST) out.push(pts[i])
  }
  out.push(pts[pts.length - 1])
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Chalkboard() {
  // Board canvas
  const canvasRef    = useRef(null)
  const bgRef        = useRef(null)
  const minimapRef   = useRef(null)
  const rafId        = useRef(null)
  const isPanningRef = useRef(false)
  const panStartRef  = useRef(null)
  const lastTouchRef = useRef(null)
  const vpInitRef    = useRef(false)
  const vpRef        = useRef({ x: 7200, y: 4050, scale: 1 })

  // Sketch canvas
  const sketchRef       = useRef(null)
  const sketchBgRef     = useRef(null)
  const sketchPts       = useRef([])
  const sketchStrokes   = useRef([])
  const isSketchDrawRef = useRef(false)

  // Placing mode: { imageData, img, wx, wy }
  const placingRef      = useRef(null)
  const placingTouchRef = useRef(null)

  // Image cache: id → HTMLImageElement
  const imgCacheRef   = useRef({})
  const allEntriesRef = useRef([])

  // Hover tooltip
  const tooltipElemRef  = useRef(null)
  const tooltipHideTimer = useRef(null)
  const lastHitIdRef    = useRef(null)

  const state$ = useRef({ sizeIdx: 1, name: '', color: 'white' })

  const [isPanning,     setIsPanning]     = useState(false)
  const [name,          setName]          = useState(() => localStorage.getItem('chalk_name') || '')
  const [sizeIdx,       setSizeIdx]       = useState(1)
  const [colorKey,      setColorKey]      = useState('white')
  const [mode,          setMode]          = useState('board') // 'board' | 'sketch' | 'placing'
  const [sketchCanUndo, setSketchCanUndo] = useState(false)
  const [isPasting,     setIsPasting]     = useState(false)
  const [isTouch]                         = useState(() => window.matchMedia?.('(hover: none)').matches ?? false)
  const [displayedEntry, setDisplayedEntry] = useState(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  state$.current.sizeIdx = sizeIdx
  state$.current.name    = name
  state$.current.color   = colorKey

  // ── Minimap ──────────────────────────────────────────────────────────────

  const updateMinimap = useCallback(() => {
    const mm = minimapRef.current
    const canvas = canvasRef.current
    if (!mm || !canvas) return
    const ctx = mm.getContext('2d')
    const sx = MM_W / WORLD_W; const sy = MM_H / WORLD_H
    ctx.clearRect(0, 0, MM_W, MM_H)
    ctx.fillStyle = 'rgba(10, 24, 12, 0.88)'
    ctx.fillRect(0, 0, MM_W, MM_H)
    allEntriesRef.current.forEach((e) => {
      if (e.imageData) {
        ctx.strokeStyle = 'rgba(154, 184, 122, 0.5)'
        ctx.lineWidth = 1
        ctx.strokeRect(e.x * sx, e.y * sy, e.w * sx, e.h * sy)
      }
    })
    const { x, y, scale } = vpRef.current
    const CW = canvas.width, CH = canvas.height
    const vw = Math.min(MM_W, (CW / scale) * sx)
    const vh = Math.min(MM_H, (CH / scale) * sy)
    ctx.fillStyle = 'rgba(154, 184, 122, 0.1)'
    ctx.fillRect(Math.max(0, x * sx), Math.max(0, y * sy), vw, vh)
    ctx.strokeStyle = 'rgba(154, 184, 122, 0.7)'; ctx.lineWidth = 1
    ctx.strokeRect(Math.max(0, x * sx) + 0.5, Math.max(0, y * sy) + 0.5, vw - 1, vh - 1)
    ctx.strokeStyle = 'rgba(109, 138, 82, 0.35)'
    ctx.strokeRect(0.5, 0.5, MM_W - 1, MM_H - 1)
    ctx.font = '8px "Courier New", monospace'; ctx.fillStyle = 'rgba(154, 184, 122, 0.3)'
    ctx.fillText('16 000 × 9 000', 4, MM_H - 4)
  }, [])

  // ── Board rendering ───────────────────────────────────────────────────────

  const renderBg = useCallback(() => {
    const bg = bgRef.current
    const canvas = canvasRef.current
    if (!bg || !canvas || canvas.width === 0) return
    const ctx = bg.getContext('2d')
    const { x, y, scale } = vpRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale)
    allEntriesRef.current.forEach((e) => {
      if (e.imageData) {
        const img = imgCacheRef.current[e.id]
        if (img?.complete && img.naturalWidth > 0) {
          ctx.save()
          ctx.globalAlpha = 0.94
          ctx.drawImage(img, e.x, e.y, e.w, e.h)
          ctx.restore()
        }
      } else if (e.strokes) {
        e.strokes.forEach((s) =>
          drawCrayon(ctx, s.points, BRUSH_SIZES[s.size] ?? 7, getCrayonColors(s.color))
        )
      }
    })
    ctx.restore()
  }, [])

  const composite = useCallback((activePts) => {
    const canvas = canvasRef.current
    const bg = bgRef.current
    if (!canvas || !bg || canvas.width === 0) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bg, 0, 0)
    if (activePts?.length >= 2) {
      const { x, y, scale } = vpRef.current
      ctx.save()
      ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale)
      drawCrayon(ctx, activePts, BRUSH_SIZES[state$.current.sizeIdx], getCrayonColors(state$.current.color))
      ctx.restore()
    }
    const pl = placingRef.current
    if (pl?.img?.complete && pl.img.naturalWidth > 0) {
      const { x, y, scale } = vpRef.current
      ctx.save()
      ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale)
      ctx.globalAlpha = 0.78
      ctx.drawImage(pl.img, pl.wx, pl.wy, SK_W, SK_H)
      ctx.restore()
    }
    updateMinimap()
  }, [updateMinimap])

  // ── Sketch rendering (defined early so keyboard effect can reference undoSketch) ──

  const renderSketchBg = useCallback(() => {
    const bg = sketchBgRef.current
    if (!bg) return
    const ctx = bg.getContext('2d')
    ctx.clearRect(0, 0, SK_W, SK_H)
    ctx.fillStyle = '#243a28'; ctx.fillRect(0, 0, SK_W, SK_H)
    sketchStrokes.current.forEach((s) =>
      drawCrayon(ctx, s.points, BRUSH_SIZES[s.size], getCrayonColors(s.color))
    )
  }, [])

  const compositeSketch = useCallback((activePts) => {
    const canvas = sketchRef.current
    const bg = sketchBgRef.current
    if (!canvas || !bg) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, SK_W, SK_H)
    ctx.drawImage(bg, 0, 0)
    if (activePts?.length >= 2) {
      drawCrayon(ctx, activePts, BRUSH_SIZES[state$.current.sizeIdx], getCrayonColors(state$.current.color))
    }
  }, [])

  const undoSketch = useCallback(() => {
    sketchStrokes.current.pop()
    setSketchCanUndo(sketchStrokes.current.length > 0)
    renderSketchBg()
    compositeSketch([])
  }, [renderSketchBg, compositeSketch])

  const clearSketch = useCallback(() => {
    sketchStrokes.current = []
    setSketchCanUndo(false)
    renderSketchBg()
    compositeSketch([])
  }, [renderSketchBg, compositeSketch])

  // ── World coordinate helper ───────────────────────────────────────────────

  const toWorldCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    const { x, y, scale } = vpRef.current
    const cx = (clientX - rect.left) * (canvas.width / rect.width)
    const cy = (clientY - rect.top) * (canvas.height / rect.height)
    return [x + cx / scale, y + cy / scale]
  }, [])

  // ── Hover tooltip ─────────────────────────────────────────────────────────

  const hideTooltip = useCallback(() => {
    lastHitIdRef.current = null
    setTooltipVisible(false)
    clearTimeout(tooltipHideTimer.current)
    tooltipHideTimer.current = setTimeout(() => setDisplayedEntry(null), 280)
  }, [])

  const handleBoardHover = useCallback((clientX, clientY) => {
    if (tooltipElemRef.current) {
      tooltipElemRef.current.style.left = (clientX + 16) + 'px'
      tooltipElemRef.current.style.top = (clientY - 8) + 'px'
    }
    const [wx, wy] = toWorldCoords(clientX, clientY)
    const hit = allEntriesRef.current.find(
      (entry) => entry.imageData && wx >= entry.x && wx <= entry.x + entry.w && wy >= entry.y && wy <= entry.y + entry.h
    )
    if (hit) {
      if (tooltipHideTimer.current) { clearTimeout(tooltipHideTimer.current); tooltipHideTimer.current = null }
      if (lastHitIdRef.current !== hit.id) {
        lastHitIdRef.current = hit.id
        setDisplayedEntry(hit)
        setTooltipVisible(true)
      }
    } else {
      if (lastHitIdRef.current !== null) hideTooltip()
    }
  }, [toWorldCoords, hideTooltip])

  // ── Placing mode ──────────────────────────────────────────────────────────

  const handlePlacingMove = useCallback((clientX, clientY) => {
    const pl = placingRef.current
    if (!pl) return
    const [wx, wy] = toWorldCoords(clientX, clientY)
    pl.wx = Math.round(wx - SK_W / 2)
    pl.wy = Math.round(wy - SK_H / 2)
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => composite([]))
  }, [toWorldCoords, composite])

  const enterPlacing = useCallback(() => {
    if (sketchStrokes.current.length === 0) return
    const off = document.createElement('canvas')
    off.width = SK_W; off.height = SK_H
    const ctx = off.getContext('2d')
    sketchStrokes.current.forEach((s) =>
      drawCrayon(ctx, s.points, BRUSH_SIZES[s.size], getCrayonColors(s.color))
    )
    const imageData = off.toDataURL('image/png')
    const img = new Image()
    img.src = imageData
    const canvas = canvasRef.current
    const { x, y, scale } = vpRef.current
    const wx = Math.round(x + (canvas?.width ?? SK_W) / (2 * scale) - SK_W / 2)
    const wy = Math.round(y + (canvas?.height ?? SK_H) / (2 * scale) - SK_H / 2)
    placingRef.current = { imageData, img, wx, wy }
    img.onload = () => composite([])
    setMode('placing')
  }, [composite])

  const confirmPlacement = useCallback(async (clientX, clientY) => {
    const pl = placingRef.current
    if (!pl) return
    if (clientX != null && clientY != null) {
      const [wx, wy] = toWorldCoords(clientX, clientY)
      pl.wx = Math.round(wx - SK_W / 2)
      pl.wy = Math.round(wy - SK_H / 2)
    }
    const { imageData, img, wx: finalWx, wy: finalWy } = pl
    placingRef.current = null
    setMode('board')
    setIsPasting(true)
    renderBg(); composite([])
    try {
      const { name } = state$.current
      const res = await fetch('/api/chalkboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'anonymous', imageData, x: finalWx, y: finalWy, w: SK_W, h: SK_H }),
      })
      const data = await res.json()
      if (data.id) {
        allEntriesRef.current.push({ id: data.id, name: name.trim() || 'anonymous', imageData, x: finalWx, y: finalWy, w: SK_W, h: SK_H })
        imgCacheRef.current[data.id] = img
        sketchBgRef.current = null
        sketchStrokes.current = []
        setSketchCanUndo(false)
        renderBg(); composite([])
      }
    } catch { /* silent */ }
    setIsPasting(false)
  }, [toWorldCoords, renderBg, composite])

  const cancelPlacing = useCallback(() => {
    placingRef.current = null
    renderBg(); composite([])
    setMode('sketch')
  }, [renderBg, composite])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'sketch' && mode !== 'placing') return
    const onKey = (e) => {
      if (mode === 'sketch') {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault()
          if (sketchStrokes.current.length > 0) undoSketch()
        } else if (e.key === 'Escape') {
          sketchBgRef.current = null; sketchStrokes.current = []; setSketchCanUndo(false); setMode('board')
        }
      } else {
        if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z')) {
          e.preventDefault()
          cancelPlacing()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, undoSketch, cancelPlacing])

  // ── Sketch canvas setup ───────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'sketch') return
    const canvas = sketchRef.current
    if (!canvas) return
    if (!sketchBgRef.current) {
      const bg = document.createElement('canvas')
      bg.width = SK_W; bg.height = SK_H
      sketchBgRef.current = bg
      sketchStrokes.current = []
      setSketchCanUndo(false)
    }
    renderSketchBg()
    compositeSketch([])
  }, [mode, renderSketchBg, compositeSketch])

  // ── Sketch draw handlers ──────────────────────────────────────────────────

  const toSketchCoords = useCallback((clientX, clientY) => {
    const canvas = sketchRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    return [
      (clientX - rect.left) * (SK_W / rect.width),
      (clientY - rect.top) * (SK_H / rect.height),
    ]
  }, [])

  const startSketchDraw = useCallback((clientX, clientY) => {
    const pt = toSketchCoords(clientX, clientY)
    sketchPts.current = [pt, pt]
    isSketchDrawRef.current = true
  }, [toSketchCoords])

  const moveSketchDraw = useCallback((clientX, clientY) => {
    if (!isSketchDrawRef.current) return
    sketchPts.current = [...sketchPts.current, toSketchCoords(clientX, clientY)]
    compositeSketch(sketchPts.current)
  }, [toSketchCoords, compositeSketch])

  const endSketchDraw = useCallback(() => {
    if (!isSketchDrawRef.current) return
    isSketchDrawRef.current = false
    const pts = simplify(sketchPts.current)
    sketchPts.current = []
    if (pts.length < 2) { compositeSketch([]); return }
    const { sizeIdx, color } = state$.current
    sketchStrokes.current.push({ size: sizeIdx, color, points: pts })
    setSketchCanUndo(true)
    renderSketchBg()
    compositeSketch([])
  }, [renderSketchBg, compositeSketch])

  // ── Canvas resize (board) ─────────────────────────────────────────────────

  useEffect(() => {
    const bg = document.createElement('canvas')
    bgRef.current = bg
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const iw = canvas.clientWidth; const ih = canvas.clientHeight
      if (iw === 0 || ih === 0) return
      if (canvas.width === iw && canvas.height === ih) return
      canvas.width = iw; canvas.height = ih; bg.width = iw; bg.height = ih
      if (!vpInitRef.current) {
        vpInitRef.current = true
        vpRef.current = { x: Math.max(0, (WORLD_W - iw) / 2), y: Math.max(0, (WORLD_H - ih) / 2), scale: 1 }
      }
      renderBg(); composite([])
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [renderBg, composite])

  // ── Load entries from API ─────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/chalkboard')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        allEntriesRef.current = data
        const cache = {}
        let pending = 0
        data.forEach((e) => {
          if (e.imageData) {
            pending++
            const img = new Image()
            img.onload = img.onerror = () => {
              pending--
              if (pending === 0) { renderBg(); composite([]) }
            }
            img.src = e.imageData
            cache[e.id] = img
          }
        })
        imgCacheRef.current = cache
        if (pending === 0) {
          renderBg()
          const ctx = canvasRef.current?.getContext('2d')
          if (ctx && bgRef.current) ctx.drawImage(bgRef.current, 0, 0)
          updateMinimap()
        }
      })
      .catch(() => {})
  }, [renderBg, composite, updateMinimap])

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const CW = canvas.width; const CH = canvas.height
    const cx = (e.clientX - rect.left) * (CW / rect.width)
    const cy = (e.clientY - rect.top) * (CH / rect.height)
    const { x, y, scale } = vpRef.current
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
    const wx = x + cx / scale; const wy = y + cy / scale
    vpRef.current = {
      scale: newScale,
      x: Math.max(0, Math.min(WORLD_W - CW / newScale, wx - cx / newScale)),
      y: Math.max(0, Math.min(WORLD_H - CH / newScale, wy - cy / newScale)),
    }
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => { renderBg(); composite([]) })
  }, [renderBg, composite])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Mouse pan (right-button) ──────────────────────────────────────────────

  const startPan = useCallback((clientX, clientY) => {
    isPanningRef.current = true; setIsPanning(true)
    panStartRef.current = { clientX, clientY, vpX: vpRef.current.x, vpY: vpRef.current.y }
  }, [])

  const movePan = useCallback((clientX, clientY) => {
    if (!isPanningRef.current || !panStartRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const { scale } = vpRef.current; const CW = canvas.width; const CH = canvas.height
    const dx = (clientX - panStartRef.current.clientX) * (CW / rect.width) / scale
    const dy = (clientY - panStartRef.current.clientY) * (CH / rect.height) / scale
    vpRef.current = {
      ...vpRef.current,
      x: Math.max(0, Math.min(WORLD_W - CW / scale, panStartRef.current.vpX - dx)),
      y: Math.max(0, Math.min(WORLD_H - CH / scale, panStartRef.current.vpY - dy)),
    }
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => { renderBg(); composite([]) })
  }, [renderBg, composite])

  const endPan = useCallback(() => {
    isPanningRef.current = false; setIsPanning(false); panStartRef.current = null
  }, [])

  // ── Touch: pan+zoom (2 fingers) ───────────────────────────────────────────

  const handleTouchStart = useCallback((e) => {
    e.preventDefault()
    const touches = Array.from(e.touches)
    if (touches.length === 1) {
      lastTouchRef.current = null
    } else if (touches.length >= 2) {
      const t0 = touches[0]; const t1 = touches[1]
      lastTouchRef.current = {
        mid: { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 },
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
      }
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    e.preventDefault()
    const touches = Array.from(e.touches)
    if (touches.length >= 2 && lastTouchRef.current) {
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const CW = canvas.width; const CH = canvas.height
      const t0 = touches[0]; const t1 = touches[1]
      const mid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 }
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const { x, y, scale } = vpRef.current
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (dist / lastTouchRef.current.dist)))
      const prevCx = (lastTouchRef.current.mid.x - rect.left) * (CW / rect.width)
      const prevCy = (lastTouchRef.current.mid.y - rect.top) * (CH / rect.height)
      const wx = x + prevCx / scale; const wy = y + prevCy / scale
      const newCx = (mid.x - rect.left) * (CW / rect.width)
      const newCy = (mid.y - rect.top) * (CH / rect.height)
      vpRef.current = {
        scale: newScale,
        x: Math.max(0, Math.min(WORLD_W - CW / newScale, wx - newCx / newScale)),
        y: Math.max(0, Math.min(WORLD_H - CH / newScale, wy - newCy / newScale)),
      }
      lastTouchRef.current = { mid, dist }
      if (rafId.current) cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => { renderBg(); composite([]) })
    }
  }, [renderBg, composite])

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault()
    if (e.touches.length < 2) lastTouchRef.current = null
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  const handleNameChange = (e) => {
    setName(e.target.value)
    localStorage.setItem('chalk_name', e.target.value)
  }

  const canDraw = name.trim().length > 0
  const activeCrayon = CRAYONS.find((c) => c.key === colorKey) ?? CRAYONS[0]

  const ToolButtons = () => (
    <>
      <div className="chalk-sizes" role="group" aria-label="Brush size">
        {BRUSH_SIZES.map((sz, i) => (
          <button
            aria-pressed={sizeIdx === i}
            className={`chalk-size-btn${sizeIdx === i ? ' active' : ''}`}
            key={sz}
            onClick={() => setSizeIdx(i)}
            style={{ '--dot': `${Math.min(sz * 0.85, 22)}px` }}
            title={`Size ${i + 1}`}
            type="button"
          />
        ))}
      </div>
      <div className="chalk-crayon-picker" role="group" aria-label="Crayon colour">
        {CRAYONS.map((c) => (
          <button
            aria-pressed={colorKey === c.key}
            className={`chalk-crayon-pick${colorKey === c.key ? ' active' : ''}`}
            key={c.key}
            onClick={() => setColorKey(c.key)}
            title={c.key}
            type="button"
          >
            <img alt={c.key} src={c.img} />
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div className="chalk-page">
      <Fireflies />

      {/* ── Board topbar ── */}
      <div className="chalk-topbar">
        <Link className="chalk-back-btn" to="/">← home</Link>
        <span className="chalk-topbar-title">chalkboard</span>
        <div className="chalk-topbar-tools">
          <input
            className="chalk-name-input"
            maxLength={24}
            onChange={handleNameChange}
            placeholder="your name..."
            type="text"
            value={name}
          />
          <button
            className="chalk-sketch-open-btn"
            disabled={!canDraw}
            onClick={() => setMode('sketch')}
            title={canDraw ? 'Open sketch pad' : 'Enter your name first'}
            type="button"
          >
            ✏ new sketch
          </button>
          {!canDraw && <span className="chalk-name-hint">enter your name to draw</span>}
        </div>
      </div>

      {/* ── Board canvas ── */}
      <div className="chalk-canvas-wrap">
        <canvas
          className="chalk-canvas"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            if (mode !== 'placing' && e.button === 2) startPan(e.clientX, e.clientY)
          }}
          onMouseLeave={() => { if (mode !== 'placing') { endPan(); hideTooltip() } }}
          onMouseMove={(e) => {
            if (mode === 'placing') { handlePlacingMove(e.clientX, e.clientY); return }
            if (isPanningRef.current) movePan(e.clientX, e.clientY)
            handleBoardHover(e.clientX, e.clientY)
          }}
          onMouseUp={(e) => {
            if (mode === 'placing' && e.button === 0) confirmPlacement(e.clientX, e.clientY)
            else if (e.button === 2) endPan()
          }}
          onTouchEnd={(e) => {
            if (mode === 'placing') {
              e.preventDefault()
              const touch = e.changedTouches[0]
              const start = placingTouchRef.current
              if (touch && start) {
                const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y)
                if (moved < 15 && Date.now() - start.time < 500) {
                  confirmPlacement(touch.clientX, touch.clientY)
                  return
                }
              }
            } else {
              handleTouchEnd(e)
            }
          }}
          onTouchMove={(e) => {
            if (mode === 'placing') {
              e.preventDefault()
              if (e.touches[0]) handlePlacingMove(e.touches[0].clientX, e.touches[0].clientY)
            } else {
              handleTouchMove(e)
            }
          }}
          onTouchStart={(e) => {
            if (mode === 'placing') {
              e.preventDefault()
              if (e.touches[0]) {
                placingTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
                handlePlacingMove(e.touches[0].clientX, e.touches[0].clientY)
              }
            } else {
              handleTouchStart(e)
            }
          }}
          ref={canvasRef}
          style={{ cursor: mode === 'placing' ? 'crosshair' : isPanning ? 'grabbing' : 'default' }}
        />
        <div className="chalk-vignette" aria-hidden="true" />
        <div
          aria-hidden="true"
          className={`chalk-hover-tooltip${tooltipVisible ? ' chalk-hover-tooltip--visible' : ''}`}
          ref={tooltipElemRef}
        >
          {displayedEntry ? `— ${displayedEntry.name}` : ''}
        </div>
        <div className="chalk-minimap-wrap" aria-hidden="true">
          <canvas className="chalk-minimap" height={MM_H} ref={minimapRef} width={MM_W} />
          <span className="chalk-nav-hint">
            {isTouch ? 'two fingers to pan & zoom' : 'scroll to zoom · right-drag to pan'}
          </span>
        </div>

        {/* ── Placing mode bar ── */}
        {mode === 'placing' && (
          <div className="chalk-placing-bar">
            <button className="chalk-placing-back" onClick={cancelPlacing} type="button">
              ← back
            </button>
            <span className="chalk-placing-hint">
              {isTouch ? 'drag to position · tap to place' : 'move to position · click to place'}
            </span>
            <button
              className="chalk-placing-confirm"
              disabled={isPasting}
              onClick={() => confirmPlacement()}
              type="button"
            >
              {isPasting ? 'placing...' : '✓ place here'}
            </button>
          </div>
        )}
      </div>

      {/* ── Sketch overlay ── */}
      {mode === 'sketch' && (
        <div className="chalk-sketch-overlay">
          <div className="chalk-sketch-modal">
            <div className="chalk-sketch-header">
              <button
                className="chalk-sketch-cancel"
                onClick={() => { sketchBgRef.current = null; sketchStrokes.current = []; setSketchCanUndo(false); setMode('board') }}
                type="button"
              >
                ✕ cancel
              </button>
              <span className="chalk-sketch-title">sketch pad</span>
              <div className="chalk-sketch-actions">
                <button
                  className="chalk-undo-btn"
                  disabled={!sketchCanUndo}
                  onClick={undoSketch}
                  title="Ctrl+Z"
                  type="button"
                >
                  ↩ undo
                </button>
                <button
                  className="chalk-sketch-clear"
                  disabled={!sketchCanUndo}
                  onClick={clearSketch}
                  type="button"
                >
                  clear
                </button>
                <button
                  className="chalk-sketch-paste"
                  disabled={!sketchCanUndo}
                  onClick={enterPlacing}
                  type="button"
                >
                  place on board ↵
                </button>
              </div>
            </div>

            <canvas
              className="chalk-sketch-canvas"
              height={SK_H}
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => { if (e.button === 0) startSketchDraw(e.clientX, e.clientY) }}
              onMouseLeave={endSketchDraw}
              onMouseMove={(e) => { if (isSketchDrawRef.current) moveSketchDraw(e.clientX, e.clientY) }}
              onMouseUp={(e) => { if (e.button === 0) endSketchDraw() }}
              onTouchEnd={(e) => { e.preventDefault(); endSketchDraw() }}
              onTouchMove={(e) => { e.preventDefault(); if (e.touches[0]) moveSketchDraw(e.touches[0].clientX, e.touches[0].clientY) }}
              onTouchStart={(e) => { e.preventDefault(); if (e.touches[0]) startSketchDraw(e.touches[0].clientX, e.touches[0].clientY) }}
              ref={sketchRef}
              style={{ cursor: `url(${activeCrayon.img}) 4 28, crosshair` }}
              width={SK_W}
            />

            <div className="chalk-sketch-tools">
              <ToolButtons />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
