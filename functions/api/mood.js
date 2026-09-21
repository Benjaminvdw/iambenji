const KEY = 'site-mood'
const DEFAULT = 'like sitting in a cafe on a friday night'

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
  if (!env.DIARY_ENTRIES) return json({ mood: DEFAULT })
  const raw = await env.DIARY_ENTRIES.get(KEY)
  return json({ mood: raw ?? DEFAULT })
}

export async function onRequestPost({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid body' }, { status: 400 }) }

  const mood = (body.mood || '').trim().slice(0, 120)
  if (!mood) return json({ error: 'Missing mood' }, { status: 400 })

  await env.DIARY_ENTRIES.put(KEY, mood)
  return json({ mood })
}
