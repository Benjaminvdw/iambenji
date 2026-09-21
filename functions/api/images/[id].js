export async function onRequestGet({ params, env }) {
  if (!env.DIARY_ENTRIES) return new Response('Missing KV binding', { status: 500 })

  const { id } = params
  if (!id) return new Response('Not found', { status: 404 })

  const { value, metadata } = await env.DIARY_ENTRIES.getWithMetadata(`img-${id}`, { type: 'arrayBuffer' })
  if (!value) return new Response('Not found', { status: 404 })

  const contentType = metadata?.contentType || 'application/octet-stream'
  return new Response(value, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
