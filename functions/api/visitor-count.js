const COUNTER_KEY = 'visitor-count'

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
}

export async function onRequestGet({ env }) {
  if (!env.VISITOR_COUNTER) {
    return json({ error: 'Missing VISITOR_COUNTER KV binding' }, { status: 500 })
  }

  const count = Number(await env.VISITOR_COUNTER.get(COUNTER_KEY)) || 0
  return json({ count })
}

export async function onRequestPost({ env }) {
  if (!env.VISITOR_COUNTER) {
    return json({ error: 'Missing VISITOR_COUNTER KV binding' }, { status: 500 })
  }

  const count = Number(await env.VISITOR_COUNTER.get(COUNTER_KEY)) || 0
  const nextCount = count + 1
  await env.VISITOR_COUNTER.put(COUNTER_KEY, String(nextCount))

  return json({ count: nextCount })
}
