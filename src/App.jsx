import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Dandelion from './Dandelion'
import Fireflies from './Fireflies'
import PostItBoard from './PostItBoard'
import DiaryFeed from './DiaryFeed'
import starsBlinkie from './assets/blinkies/0124-stars.gif'
import leavesBlinkie from './assets/blinkies/0191-fallleaves.gif'
import cafeKyBlinkie from './assets/blinkies/blinkiesCafe-ky.gif'
import cafeMvBlinkie from './assets/blinkies/blinkiesCafe-mV.gif'
import v1Blinkie from './assets/blinkies/v1.gif'
import x29Blinkie from './assets/blinkies/x29.gif'
import fallbackAvatar from './assets/blinkies/avatar/IMG_0012.JPG'
import GlobeTab from './Globe'

const TAB_PATHS = {
  diary: '/',
  profile: '/profile',
  links: '/links',
  now: '/now',
  postits: '/postits',
  globe: '/globe',
}

const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_PATHS).map(([k, v]) => [v, k]))

const tabs = {
  diary: {
    label: 'Diary',
    title: 'Entries',
    stamp: 'thoughts, moments, whatever',
    body: [],
  },
  profile: {
    label: 'Profile',
    title: 'About me',
    stamp: 'status: online-ish',
    body: [
      'Name: Benji. Location: in a dream',
      'Interests: Rock music, reading, gaming, creating',
      'Hello! My name is Benjamin but most people call me Benji, it was a name that always stuck to me since childhood. I’m a 22 year old fullstack developer from the Netherlands. I love listening to rock music, but occasionally enjoy other genres as well. I like to play games, some of my favorites include: Little Big Planet, Minecraft, and OSU!',
      'I value alone time a lot, it helps me recharge and get in touch with my thoughts. Sometimes I like taking late night walks, I like how quiet it is, and how cozy it feels.'
    ],
  },
  links: {
    label: 'Links',
    title: 'Link stash',
    stamp: 'Putting all the cool people here',
    body: [],
  },
  now: {
    label: 'Now listening',
    title: 'Now playing',
    stamp: 'Spotify',
    body: [],
  },
  postits: {
    label: 'Post-its',
    title: 'The wall',
    stamp: 'Leave a note for whoever passes by',
    body: [],
  },
  globe: {
    label: 'Globe',
    title: 'What are you listening to?',
    stamp: 'Drop a pin :)',
    body: [],
  },
}

const fallbackTrack = {
  title: 'Flew Away',
  artist: 'Murr',
  album: 'currently on repeat',
  image: '',
  isPlaying: false,
  progress: 68,
}

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`
const SPOTIFY_SCOPES = 'user-read-currently-playing'
const SPOTIFY_TOKEN_KEY = 'benji_spotify_tokens'
const SPOTIFY_VERIFIER_KEY = 'benji_spotify_code_verifier'
const SPOTIFY_NOW_PLAYING_ENDPOINT = import.meta.env.VITE_SPOTIFY_NOW_PLAYING_ENDPOINT || '/api/spotify-now-playing'
const VISITOR_COUNT_ENDPOINT = import.meta.env.VITE_VISITOR_COUNT_ENDPOINT || '/api/visitor-count'

function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function createCodeVerifier() {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

function localGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function localSet(key, value) {
  try { localStorage.setItem(key, value) } catch { }
}

function getStoredTokens() {
  const saved = localGet(SPOTIFY_TOKEN_KEY)
  return saved ? JSON.parse(saved) : null
}

function saveTokens(tokens) {
  localSet(SPOTIFY_TOKEN_KEY, JSON.stringify({
    ...tokens,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }))
}

async function refreshSpotifyToken(tokens) {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) throw new Error('Could not refresh Spotify token')

  const nextTokens = await response.json()
  const mergedTokens = {
    ...tokens,
    ...nextTokens,
    refresh_token: nextTokens.refresh_token || tokens.refresh_token,
  }
  saveTokens(mergedTokens)
  return getStoredTokens()
}

const blinkies = [
  { alt: 'stars blinkie', src: starsBlinkie },
  { alt: 'fall leaves blinkie', src: leavesBlinkie },
  { alt: 'cafe blinkie', src: cafeKyBlinkie },
  { alt: 'cafe blinkie', src: cafeMvBlinkie },
  { alt: 'v1 blinkie', src: v1Blinkie },
  { alt: 'x29 blinkie', src: x29Blinkie },
]

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeTab = PATH_TO_TAB[pathname] ?? 'diary'
  const [spotifyTokens, setSpotifyTokens] = useState(() => getStoredTokens())
  const [spotifyTrack, setSpotifyTrack] = useState(fallbackTrack)
  const [spotifyStatus, setSpotifyStatus] = useState('loading')
  const [links, setLinks] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(fallbackAvatar)
  const [mood, setMood] = useState('like sitting in a cafe on a friday night')
  const [visitorCount, setVisitorCount] = useState(0)
  const [visitorStatus, setVisitorStatus] = useState(() => {
    if (localGet('visitor_known')) return 'counted'
    return VISITOR_COUNT_ENDPOINT ? 'ready' : 'setup-needed'
  })
  const active = tabs[activeTab]
  const liveDiaryStamp = `07.05.2026 // listening to: ${spotifyTrack.title} - ${spotifyTrack.artist}`
  const activeStamp = activeTab === 'diary' ? liveDiaryStamp : active.stamp
  const visitorDisplay = String(visitorCount).padStart(6, '0')

  const loginToSpotify = async () => {
    if (!SPOTIFY_CLIENT_ID) {
      setSpotifyStatus('setup-needed')
      return
    }

    const verifier = createCodeVerifier()
    const challenge = await createCodeChallenge(verifier)
    localSet(SPOTIFY_VERIFIER_KEY, verifier)

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })

    window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`)
  }

  const logoutSpotify = () => {
    try { localStorage.removeItem(SPOTIFY_TOKEN_KEY) } catch { }
    try { localStorage.removeItem(SPOTIFY_VERIFIER_KEY) } catch { }
    setSpotifyTokens(null)
    setSpotifyTrack(fallbackTrack)
    setSpotifyStatus(SPOTIFY_CLIENT_ID ? 'signed-out' : 'setup-needed')
  }

  useEffect(() => {
    fetch('/api/discord-avatar')
      .then((r) => r.json())
      .then((data) => { if (data.url) setAvatarUrl(data.url) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/links')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLinks(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/mood')
      .then((r) => r.json())
      .then((data) => { if (data.mood) setMood(data.mood) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(VISITOR_COUNT_ENDPOINT)
      .then((r) => r.json())
      .then((data) => {
        const count = typeof data === 'number' ? data : data.count
        if (Number.isFinite(count)) setVisitorCount(count)
      })
      .catch(() => {})
  }, [])

  const letMeBeKnown = async () => {
    if (!VISITOR_COUNT_ENDPOINT) {
      setVisitorStatus('setup-needed')
      return
    }

    setVisitorStatus('counting')

    try {
      const response = await fetch(VISITOR_COUNT_ENDPOINT, { method: 'POST' })
      if (!response.ok) throw new Error('Could not update visitor count')

      const data = await response.json()
      const nextCount = typeof data === 'number' ? data : data.count

      if (Number.isFinite(nextCount)) {
        setVisitorCount(nextCount)
      } else {
        setVisitorCount((count) => count + 1)
      }

      localSet('visitor_known', '1')
      setVisitorStatus('counted')
    } catch (error) {
      console.error(error)
      setVisitorStatus('error')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (window.location.pathname !== '/callback' || !code || !SPOTIFY_CLIENT_ID) return

    const exchangeCode = async () => {
      navigate('/now')
      setSpotifyStatus('loading')

      try {
        const verifier = localGet(SPOTIFY_VERIFIER_KEY)
        if (!verifier) throw new Error('Missing Spotify code verifier')

        const body = new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier,
        })

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })

        if (!response.ok) throw new Error('Spotify login failed')

        saveTokens(await response.json())
        try { localStorage.removeItem(SPOTIFY_VERIFIER_KEY) } catch { }
        setSpotifyTokens(getStoredTokens())
        setSpotifyStatus('loading')
        window.history.replaceState({}, '', '/')
      } catch (error) {
        console.error(error)
        setSpotifyStatus('error')
      }
    }

    exchangeCode()
  }, [])

  useEffect(() => {
    if (!SPOTIFY_CLIENT_ID || !spotifyTokens) return

    let isCancelled = false

    const fetchCurrentTrack = async () => {
      setSpotifyStatus((status) => status === 'signed-out' ? 'loading' : status)

      try {
        let tokens = spotifyTokens

        if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
          tokens = await refreshSpotifyToken(tokens)
          if (!isCancelled) setSpotifyTokens(tokens)
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        if (response.status === 204) {
          if (!isCancelled) {
            setSpotifyTrack({ ...fallbackTrack, title: 'Nothing playing', artist: 'Spotify is quiet', progress: 0 })
            setSpotifyStatus('idle')
          }
          return
        }

        if (response.status === 401) {
          const refreshed = await refreshSpotifyToken(tokens)
          if (!isCancelled) setSpotifyTokens(refreshed)
          return
        }

        if (!response.ok) throw new Error('Could not fetch current Spotify track')

        const data = await response.json()
        const item = data.item
        const duration = item?.duration_ms || 1
        const progress = Math.round(((data.progress_ms || 0) / duration) * 100)

        if (!isCancelled) {
          setSpotifyTrack({
            title: item?.name || 'Unknown track',
            artist: item?.artists?.map((artist) => artist.name).join(', ') || item?.show?.publisher || 'Unknown artist',
            album: item?.album?.name || item?.show?.name || 'Spotify',
            image: item?.album?.images?.[0]?.url || item?.images?.[0]?.url || '',
            isPlaying: data.is_playing,
            progress: Math.min(100, Math.max(0, progress)),
          })
          setSpotifyStatus(data.is_playing ? 'playing' : 'paused')
        }
      } catch (error) {
        console.error(error)
        if (!isCancelled) setSpotifyStatus('error')
      }
    }

    fetchCurrentTrack()
    const intervalId = window.setInterval(fetchCurrentTrack, 30000)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [spotifyTokens])

  useEffect(() => {
    let isCancelled = false

    const fetchServerSpotifyStatus = async () => {
      try {
        const response = await fetch(SPOTIFY_NOW_PLAYING_ENDPOINT)
        if (!response.ok) throw new Error('Cloudflare Spotify endpoint is not ready')

        const data = await response.json()

        if (isCancelled) return

        if (!data.track) {
          setSpotifyTrack({ ...fallbackTrack, title: 'Nothing playing', artist: 'Spotify is quiet', progress: 0 })
          setSpotifyStatus(data.status || 'idle')
          return
        }

        setSpotifyTrack({
          title: data.track.title,
          artist: data.track.artist,
          album: data.track.album,
          image: data.track.image,
          isPlaying: data.isPlaying,
          progress: data.track.progress,
        })
        setSpotifyStatus(data.status)
      } catch (error) {
        console.error(error)
        setSpotifyStatus(SPOTIFY_CLIENT_ID ? 'signed-out' : 'setup-needed')
      }
    }

    fetchServerSpotifyStatus()
    const intervalId = window.setInterval(fetchServerSpotifyStatus, 30000)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <main className="min-h-screen overflow-hidden px-3 py-6 text-[#d7e1c2] sm:px-6 lg:flex lg:items-center lg:px-8">
      <Fireflies />
      <div className="fixed bottom-0 -right-[18vw] top-0 w-[58vw] min-w-[420px] pointer-events-none opacity-38">
        <Dandelion />
      </div>

      <section className="blog-shell relative z-10 mx-auto grid w-full max-w-6xl gap-3 lg:grid-cols-[245px_minmax(0,1fr)_190px]">
        <aside className="retro-panel overflow-hidden">
          <div className="panel-title">navigation.webp</div>
          <div className="profile-box">
            <div className="avatar">
              <img src={avatarUrl} alt="Benji" />
            </div>
            <div>
              <h1>Benji</h1>
              <p>Internet bedroom</p>
            </div>
          </div>

          <nav className="tab-list" aria-label="Blog tabs">
            {Object.entries(tabs).map(([id, tab]) => (
              <Link
                className={`tab-button tab-button-link${activeTab === id ? ' active' : ''}`}
                key={id}
                to={TAB_PATHS[id]}
              >
                {tab.label}
              </Link>
            ))}
            <Link className="tab-button tab-button-link" to="/chalkboard">Chalkboard</Link>
          </nav>

          <div className="blinkie-rack" aria-label="Blinkie slots">
            {blinkies.map((blinkie) => (
              <img className="blinkie" key={blinkie.src} src={blinkie.src} alt={blinkie.alt} />
            ))}
          </div>
        </aside>

        <article className="retro-panel main-window">
          <div className="window-bar">
            <span>about_me.html</span>
            <div className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>

          <header className="blog-hero">
            <p className="eyebrow">welcome to paradise</p>
            <h2>{active.title}</h2>
            <div className="ticker">
              <span>{activeStamp}</span>
            </div>
          </header>

          {activeTab === 'diary' ? (
            <DiaryFeed limit={3} />
          ) : activeTab === 'postits' ? (
            <PostItBoard />
          ) : activeTab === 'now' ? (
            <div className="now-card">
              <section className="spotify-card" aria-label="Current Spotify track">
                <div className="album-art" aria-hidden="true">
                  {spotifyTrack.image ? (
                    <img alt="" src={spotifyTrack.image} />
                  ) : (
                    <>
                      <span />
                      <span />
                      <span />
                    </>
                  )}
                </div>
                <div className="track-info">
                  <p className="small-label">
                    {spotifyStatus === 'playing' ? 'currently listening' : `spotify: ${spotifyStatus}`}
                  </p>
                  <h3>{spotifyTrack.title}</h3>
                  <p>{spotifyTrack.artist} // {spotifyTrack.album}</p>
                  <div className="track-progress" aria-label={`${spotifyTrack.progress}% through track`}>
                    <span style={{ width: `${spotifyTrack.progress}%` }} />
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'globe' ? (
            <GlobeTab />
          ) : (
            <div className="entry-card">
              {active.body.map((item) => (
                <p key={item}>{item}</p>
              ))}
              {activeTab === 'links' && links.length > 0 && (
                <div className="entry-link-grid">
                  {links.map((item) => (
                    <a
                      className="entry-link-button"
                      href={item.href}
                      key={item.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
              {activeTab === 'links' && links.length === 0 && (
                <p className="diary-feed-empty">no links yet</p>
              )}
            </div>
          )}

          <div className="two-column">
            <section>
              <h3>Currently</h3>
              <ul>
                <li>listening to music (like always)</li>
                <li>looking back on my past self</li>
                <li>coding this website</li>
              </ul>
            </section>
            <section>
              <h3>Updates</h3>
              <ul>
                <li>Spotify API integration</li>
                <li>added fun blinkies</li>
                <li>putting the cherry on top</li>
              </ul>
            </section>
          </div>
        </article>

        <aside className="retro-panel extras">
          <div className="panel-title">sidebar.txt</div>
          <div className="counter">
            <span>visitors</span>
            <strong>{visitorDisplay}</strong>
            <button
              className="visitor-button"
              disabled={visitorStatus === 'counted' || visitorStatus === 'counting'}
              onClick={letMeBeKnown}
              type="button"
            >
              {visitorStatus === 'counted' ? 'you are known' : 'let me be known'}
            </button>
            <p className="visitor-status">
              {visitorStatus === 'counting' && 'counting...'}
              {visitorStatus === 'setup-needed' && 'counter awaiting server'}
              {visitorStatus === 'error' && 'counter is asleep'}
              {visitorStatus === 'ready' && 'press to say you were here'}
            </p>
          </div>
          <div className="mini-widget">
            <h3>mood</h3>
            <p>{mood}</p>
          </div>
          <div className="mini-widget">
            <h3>status</h3>
            <p>love u guys!</p>
          </div>
          <div className="button-stack">
            <Link to="/contact">email me</Link>
          </div>
        </aside>
      </section>
    </main>
  )
}
