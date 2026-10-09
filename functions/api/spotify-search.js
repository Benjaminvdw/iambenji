function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q) return json({ error: 'Missing q' }, { status: 400 })

  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    return json({ error: 'Missing Spotify credentials' }, { status: 500 })
  }

  try {
    const credentials = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })

    if (!tokenRes.ok) return json({ error: 'Could not get token' }, { status: 502 })
    const { access_token } = await tokenRes.json()

    // Search for both albums and tracks
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album,track&limit=5`
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!searchRes.ok) return json({ error: 'Search failed' }, { status: 502 })
    const data = await searchRes.json()

    // Combine albums and tracks into a single list
    const results = []
    
    if (data.albums && data.albums.items) {
      data.albums.items.forEach(item => {
        results.push({
          type: 'album',
          title: item.name,
          artist: item.artists.map(a => a.name).join(', '),
          album: item.name,
          image: item.images?.[0]?.url || '',
        })
      })
    }
    
    if (data.tracks && data.tracks.items) {
      data.tracks.items.forEach(item => {
        results.push({
          type: 'track',
          title: item.name,
          artist: item.artists.map(a => a.name).join(', '),
          album: item.album?.name || '',
          image: item.album?.images?.[0]?.url || '',
        })
      })
    }

    return json({ tracks: results.slice(0, 10) })
  } catch (err) {
    return json({ error: 'Search request failed' }, { status: 502 })
  }
}
