const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
}

function missingSecret(name) {
  return json({ error: `Missing ${name}` }, { status: 500 })
}

export async function onRequestGet({ env }) {
  if (!env.SPOTIFY_CLIENT_ID) return missingSecret('SPOTIFY_CLIENT_ID')
  if (!env.SPOTIFY_CLIENT_SECRET) return missingSecret('SPOTIFY_CLIENT_SECRET')
  if (!env.SPOTIFY_REFRESH_TOKEN) return missingSecret('SPOTIFY_REFRESH_TOKEN')

  const credentials = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)
  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  })

  if (!tokenResponse.ok) {
    return json({ error: 'Could not refresh Spotify token' }, { status: 502 })
  }

  const tokenData = await tokenResponse.json()
  const nowPlayingResponse = await fetch(SPOTIFY_NOW_PLAYING_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  })

  if (nowPlayingResponse.status === 204) {
    return json({ status: 'idle', isPlaying: false, track: null })
  }

  if (!nowPlayingResponse.ok) {
    return json({ error: 'Could not fetch Spotify now playing' }, { status: 502 })
  }

  const data = await nowPlayingResponse.json()
  const item = data.item
  const duration = item?.duration_ms || 1
  const progress = Math.round(((data.progress_ms || 0) / duration) * 100)

  return json({
    status: data.is_playing ? 'playing' : 'paused',
    isPlaying: data.is_playing,
    track: {
      title: item?.name || 'Unknown track',
      artist: item?.artists?.map((artist) => artist.name).join(', ') || item?.show?.publisher || 'Unknown artist',
      album: item?.album?.name || item?.show?.name || 'Spotify',
      image: item?.album?.images?.[0]?.url || item?.images?.[0]?.url || '',
      progress: Math.min(100, Math.max(0, progress)),
      previewUrl: item?.preview_url || null,
    },
  })
}
