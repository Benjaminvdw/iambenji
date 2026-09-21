import http from 'http'
import { exec } from 'child_process'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.')
  process.exit(1)
}
const REDIRECT_URI = 'http://127.0.0.1:8888/callback'
const SCOPE = 'user-read-currently-playing'

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  })

console.log('\nOpening Spotify login in your browser...')
console.log('If it does not open, visit this URL manually:\n')
console.log(authUrl + '\n')

exec(`open "${authUrl}"`)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:8888`)
  const code = url.searchParams.get('code')

  if (!code) {
    res.end('No code found.')
    return
  }

  res.end('<h2>Got it! Check your terminal for the refresh token.</h2>')

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const data = await tokenRes.json()

  if (data.refresh_token) {
    console.log('✅ SPOTIFY_REFRESH_TOKEN:\n')
    console.log(data.refresh_token)
    console.log()
  } else {
    console.error('❌ Failed to get refresh token:', data)
  }

  server.close()
})

server.listen(8888, () => {
  console.log('Waiting for Spotify callback on http://localhost:8888/callback ...')
})
