const KEY = 'chalkboard'
const MAX_ENTRIES = 100
const MAX_IMAGE_CHARS = 300000 // ~225 KB WebP

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
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })
  const raw = await env.DIARY_ENTRIES.get(KEY)
  return json(raw ? JSON.parse(raw) : [])
}

export async function onRequestPost({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const name = (body.name || '').trim().slice(0, 24)
  if (!name) return json({ error: 'Missing name' }, { status: 400 })

  const { imageData } = body
  if (!imageData || typeof imageData !== 'string') {
    return json({ error: 'imageData required' }, { status: 400 })
  }
  if (!/^data:image\/(webp|png);base64,/.test(imageData)) {
    return json({ error: 'Invalid image format' }, { status: 400 })
  }
  if (imageData.length > MAX_IMAGE_CHARS) {
    return json({ error: 'Image too large' }, { status: 400 })
  }

  const x = Math.round(Number(body.x) || 0)
  const y = Math.round(Number(body.y) || 0)
  const w = Math.max(1, Math.min(4000, Math.round(Number(body.w) || 800)))
  const h = Math.max(1, Math.min(4000, Math.round(Number(body.h) || 450)))

  const raw = await env.DIARY_ENTRIES.get(KEY)
  const entries = raw ? JSON.parse(raw) : []
  const id = crypto.randomUUID()
  entries.push({ id, name, imageData, x, y, w, h })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  await env.DIARY_ENTRIES.put(KEY, JSON.stringify(entries))

  return json({ ok: true, id })
}

export async function onRequestDelete({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { body = {} }

  if (body.id) {
    const raw = await env.DIARY_ENTRIES.get(KEY)
    const entries = raw ? JSON.parse(raw) : []
    await env.DIARY_ENTRIES.put(KEY, JSON.stringify(entries.filter((e) => e.id !== body.id)))
  } else {
    await env.DIARY_ENTRIES.put(KEY, JSON.stringify([]))
  }

  return json({ ok: true })
}
