function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return false
  return (request.headers.get('Authorization') || '') === `Bearer ${env.ADMIN_PASSWORD}`
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ ok: true })
}
