const KEY = 'globe-pins'
const MAX_PINS = 300

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return false
  return (request.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_PASSWORD}`
}

export async function onRequestGet({ env }) {
  if (!env.GLOBE_PINS) return json({ error: 'Missing GLOBE_PINS KV binding' }, { status: 500 })
  const raw = await env.GLOBE_PINS.get(KEY)
  return json({ pins: raw ? JSON.parse(raw) : [] })
}

export async function onRequestPost({ request, env }) {
  if (!env.GLOBE_PINS) return json({ error: 'Missing GLOBE_PINS KV binding' }, { status: 500 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const name = (body.name || '').trim().slice(0, 40)
  const track = body.track
  const normal = body.normal

  if (!name) return json({ error: 'Missing name' }, { status: 400 })
  if (!track?.title || !track?.artist) return json({ error: 'Missing track' }, { status: 400 })
  if (normal?.x == null || normal?.y == null || normal?.z == null) return json({ error: 'Missing normal' }, { status: 400 })

  const raw = await env.GLOBE_PINS.get(KEY)
  const pins = raw ? JSON.parse(raw) : []

  const pin = {
    id: crypto.randomUUID(),
    name,
    color: typeof body.color === 'number' ? body.color : null,
    track: {
      title: track.title.slice(0, 120),
      artist: track.artist.slice(0, 120),
      previewUrl: track.previewUrl || null,
      image: track.image || '',
    },
    normal: { x: Number(normal.x), y: Number(normal.y), z: Number(normal.z) },
    createdAt: new Date().toISOString(),
  }

  pins.push(pin)
  if (pins.length > MAX_PINS) pins.splice(0, pins.length - MAX_PINS)
  await env.GLOBE_PINS.put(KEY, JSON.stringify(pins))

  return json({ pin })
}

export async function onRequestDelete({ request, env }) {
  if (!env.GLOBE_PINS) return json({ error: 'Missing GLOBE_PINS KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const raw = await env.GLOBE_PINS.get(KEY)
  const pins = raw ? JSON.parse(raw) : []
  await env.GLOBE_PINS.put(KEY, JSON.stringify(pins.filter((p) => p.id !== body.id)))
  return json({ ok: true })
}
