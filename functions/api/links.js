const KEY = 'site-links'

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
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const label = (body.label || '').trim().slice(0, 80)
  const href = (body.href || '').trim().slice(0, 500)
  if (!label || !href) return json({ error: 'Missing fields' }, { status: 400 })

  const raw = await env.DIARY_ENTRIES.get(KEY)
  const links = raw ? JSON.parse(raw) : []

  const link = { id: crypto.randomUUID(), label, href }
  links.push(link)
  await env.DIARY_ENTRIES.put(KEY, JSON.stringify(links))
  return json(link)
}

export async function onRequestDelete({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const raw = await env.DIARY_ENTRIES.get(KEY)
  const links = raw ? JSON.parse(raw) : []
  await env.DIARY_ENTRIES.put(KEY, JSON.stringify(links.filter((l) => l.id !== body.id)))
  return json({ ok: true })
}
