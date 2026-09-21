function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q) return json({ error: 'Missing q' }, { status: 400 })

  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=8`
  let response
  try {
    response = await fetch(searchUrl)
  } catch {
    return json({ error: 'Search request failed' }, { status: 502 })
  }

  if (!response.ok) return json({ error: 'Search failed' }, { status: 502 })

  const data = await response.json()
  const tracks = (data.results || []).map((item) => ({
    title: item.trackName || '',
    artist: item.artistName || '',
    album: item.collectionName || '',
    image: item.artworkUrl100?.replace('100x100bb', '300x300bb') || '',
    previewUrl: item.previewUrl || null,
  }))

  return json({ tracks })
}
