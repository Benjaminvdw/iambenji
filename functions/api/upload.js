const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif'])
const MAX_SIZE = 5 * 1024 * 1024

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

export async function onRequestPost({ request, env }) {
  if (!env.DIARY_ENTRIES) return json({ error: 'Missing KV binding' }, { status: 500 })
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, { status: 401 })

  let formData
  try { formData = await request.formData() } catch { return json({ error: 'Invalid form data' }, { status: 400 }) }

  const file = formData.get('image')
  if (!file || typeof file === 'string') return json({ error: 'No image provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'Invalid file type — use PNG, JPEG or GIF' }, { status: 400 })
  if (file.size > MAX_SIZE) return json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const id = crypto.randomUUID()
  await env.DIARY_ENTRIES.put(`img-${id}`, buffer, { metadata: { contentType: file.type } })

  return json({ url: `/api/images/${id}` })
}
