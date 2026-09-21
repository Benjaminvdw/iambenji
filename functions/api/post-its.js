const KEY = 'post-its'
const MAX_NOTES = 80
const COLORS = ['#fde68a', '#bef0b0', '#fbbcdc', '#a5d8f7', '#e0c8f8', '#f9c8a0', '#a8f0e4', '#f0e0a4']

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
  if (!env.POST_ITS) return json({ error: 'Missing POST_ITS KV binding' }, { status: 500 })
  const raw = await env.POST_ITS.get(KEY)
  return json(raw ? JSON.parse(raw) : [])
}

export async function onRequestPost({ request, env }) {
  if (!env.POST_ITS) return json({ error: 'Missing POST_ITS KV binding' }, { status: 500 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const name = (body.name || '').trim().slice(0, 30)
  const message = (body.message || '').trim().slice(0, 180)
  if (!name || !message) return json({ error: 'Missing fields' }, { status: 400 })

  const raw = await env.POST_ITS.get(KEY)
  const notes = raw ? JSON.parse(raw) : []

  const note = {
    id: crypto.randomUUID(),
    name,
    message,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: (Math.random() - 0.5) * 12,
    x: 10 + Math.random() * 68,
    y: 8 + Math.random() * 68,
  }

  notes.push(note)
  if (notes.length > MAX_NOTES) notes.splice(0, notes.length - MAX_NOTES)
  await env.POST_ITS.put(KEY, JSON.stringify(notes))

  return json(note)
}

export async function onRequestPatch({ request, env }) {
  if (!env.POST_ITS) return json({ error: 'Missing POST_ITS KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, x, y } = body
  if (!id || x == null || y == null) return json({ error: 'Missing fields' }, { status: 400 })

  const raw = await env.POST_ITS.get(KEY)
  const notes = raw ? JSON.parse(raw) : []
  const updated = notes.map((n) => n.id === id ? { ...n, x: Number(x), y: Number(y) } : n)
  await env.POST_ITS.put(KEY, JSON.stringify(updated))
  return json({ ok: true })
}

export async function onRequestDelete({ request, env }) {
  if (!env.POST_ITS) return json({ error: 'Missing POST_ITS KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const raw = await env.POST_ITS.get(KEY)
  const notes = raw ? JSON.parse(raw) : []
  await env.POST_ITS.put(KEY, JSON.stringify(notes.filter((n) => n.id !== body.id)))
  return json({ ok: true })
}
