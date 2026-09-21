const KEY = 'diary-entries'

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return false
  const auth = request.headers.get('Authorization') || ''
  return auth === `Bearer ${env.ADMIN_PASSWORD}`
}

export async function onRequestGet({ env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing DIARY_ENTRIES KV binding' }, { status: 500 })
  const raw = await env.DIARY_ENTRIES.get(KEY)
  return json(raw ? JSON.parse(raw) : [])
}

export async function onRequestPost({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing DIARY_ENTRIES KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const { date, title, content, listeningTo } = body
  if (!date?.trim() || !title?.trim() || !content?.trim()) {
    return json({ error: 'Missing required fields' }, { status: 400 })
  }

  const raw = await env.DIARY_ENTRIES.get(KEY)
  const entries = raw ? JSON.parse(raw) : []

  const entry = {
    id: crypto.randomUUID(),
    date: date.trim(),
    title: title.trim(),
    content: content.trim(),
    listeningTo: listeningTo?.trim() || '',
  }

  entries.unshift(entry)
  await env.DIARY_ENTRIES.put(KEY, JSON.stringify(entries))
  return json(entry)
}

export async function onRequestDelete({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing DIARY_ENTRIES KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const raw = await env.DIARY_ENTRIES.get(KEY)
  const entries = raw ? JSON.parse(raw) : []
  await env.DIARY_ENTRIES.put(KEY, JSON.stringify(entries.filter((e) => e.id !== body.id)))
  return json({ ok: true })
}
