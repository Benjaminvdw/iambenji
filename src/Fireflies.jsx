import { useEffect, useRef } from 'react'

const COUNT = 40
const SCALE = 5
const COLORS = ['#f2df9c', '#d6ad58', '#cbe6a6', '#f0e0a4', '#d7e1c2']

export default function Fireflies() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let w, h, flies, animId

    const init = () => {
      w = Math.floor(window.innerWidth / SCALE)
      h = Math.floor(window.innerHeight / SCALE)
      canvas.width = w
      canvas.height = h

      flies = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.7 + Math.random() * 1.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() < 0.25 ? 2 : 1,
      }))
    }

    let last = 0
    const animate = (now) => {
      animId = requestAnimationFrame(animate)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      ctx.clearRect(0, 0, w, h)

      for (const f of flies) {
        f.vx += (Math.random() - 0.5) * 0.015
        f.vy += (Math.random() - 0.5) * 0.015
        const spd = Math.hypot(f.vx, f.vy)
        if (spd > 0.38) { f.vx = (f.vx / spd) * 0.38; f.vy = (f.vy / spd) * 0.38 }

        f.x += f.vx * dt * 30
        f.y += f.vy * dt * 30
        if (f.x < 0) f.x = w
        if (f.x > w) f.x = 0
        if (f.y < 0) f.y = h
        if (f.y > h) f.y = 0

        f.phase += dt * f.pulseSpeed
        const alpha = ((Math.sin(f.phase) + 1) / 2) * 0.75
        if (alpha < 0.05) continue

        ctx.globalAlpha = alpha
        ctx.fillStyle = f.color
        ctx.fillRect(Math.floor(f.x), Math.floor(f.y), f.size, f.size)
      }

      ctx.globalAlpha = 1
    }

    init()
    animId = requestAnimationFrame(animate)
    window.addEventListener('resize', init)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', init)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        height: '100vh',
        imageRendering: 'pixelated',
        left: 0,
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        width: '100vw',
        zIndex: 2,
      }}
    />
  )
}
