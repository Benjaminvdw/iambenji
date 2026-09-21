import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const RADIUS = 2

const PIN_COLORS = [
  0xe63946, 0x457b9d, 0x2a9d8f, 0xe9c46a,
  0xf4a261, 0x8338ec, 0x06d6a0, 0xfb8500,
  0x4cc9f0, 0x7209b7,
]

function randomPinColor() {
  return PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)]
}

function createPinMesh(color = 0xcc2233) {
  const group = new THREE.Group()
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.0325, 16, 12),
    new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x441111 })
  )
  head.position.set(0, 0.0325, 0)
  group.add(head)
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.001, 0.14, 8),
    new THREE.MeshPhongMaterial({ color: 0xb8b8b8, shininess: 140, specular: 0xffffff })
  )
  shaft.position.set(0, -0.045, 0)
  group.add(shaft)
  return { group, head }
}

export default function GlobeTab() {
  const mountRef = useRef(null)
  const audioRef = useRef(null)
  const audioFadeRef = useRef(null)
  const cameraRef = useRef(null)
  const earthRef = useRef(null)
  const sceneRef = useRef(null)
  const pinMeshMapRef = useRef(new Map())
  const pendingPinMeshRef = useRef(null)
  const pendingColorRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const pointerDownRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const hoveredIdRef = useRef(null)
  const pinsRef = useRef([])
  const pendingNormalRef = useRef(null)
  const cardHideTimerRef = useRef(null)

  const [pins, setPins] = useState([])
  const [isPending, setIsPending] = useState(false)
  const [userName, setUserName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [hoveredPinId, setHoveredPinId] = useState(null)
  const [pinError, setPinError] = useState(null)
  const [displayedPin, setDisplayedPin] = useState(null)
  const [cardVisible, setCardVisible] = useState(false)

  const hoveredPin = hoveredPinId ? pins.find((p) => p.id === hoveredPinId) ?? null : null

  // Fade hover card in/out without an instant unmount
  useEffect(() => {
    if (hoveredPin) {
      clearTimeout(cardHideTimerRef.current)
      setDisplayedPin(hoveredPin)
      setCardVisible(true)
    } else {
      setCardVisible(false)
      cardHideTimerRef.current = setTimeout(() => setDisplayedPin(null), 320)
    }
  }, [hoveredPin])

  // Load persisted pins
  useEffect(() => {
    fetch('/api/pins')
      .then((r) => r.json())
      .then((d) => {
        const loaded = Array.isArray(d.pins) ? d.pins : []
        setPins(loaded)
        pinsRef.current = loaded
      })
      .catch(() => {})
  }, [])

  // Sync pins state → Three.js scene meshes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const currentIds = new Set(pins.map((p) => p.id))

    for (const [id, { group }] of pinMeshMapRef.current) {
      if (!currentIds.has(id)) {
        scene.remove(group)
        pinMeshMapRef.current.delete(id)
      }
    }

    for (const pin of pins) {
      if (!pinMeshMapRef.current.has(pin.id)) {
        const { group, head } = createPinMesh(pin.color ?? 0xcc2233)
        const normal = new THREE.Vector3(pin.normal.x, pin.normal.y, pin.normal.z)
        group.position.copy(normal.clone().multiplyScalar(RADIUS))
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
        scene.add(group)
        pinMeshMapRef.current.set(pin.id, { group, head })
      }
    }
  }, [pins])

  // Three.js scene setup
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth
    const h = mount.clientHeight || 340

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 5.5
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(1)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const sun = new THREE.DirectionalLight(0xffe8b0, 1.1)
    sun.position.set(6, 4, 5)
    scene.add(sun)

    const tl = new THREE.TextureLoader()
    const geo = new THREE.SphereGeometry(RADIUS, 24, 16)
    const mat = new THREE.MeshPhongMaterial({
      map: tl.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg'),
      shininess: 8,
      flatShading: true,
    })
    const earth = new THREE.Mesh(geo, mat)
    scene.add(earth)
    earthRef.current = earth

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x8aaa9a,
      wireframe: true,
      transparent: true,
      opacity: 0.13,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.003, 24, 16), wireMat))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 2.8
    controls.maxDistance = 14
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.addEventListener('start', () => { controls.autoRotate = false })

    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight || 340
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect()
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      }
    }
    mount.addEventListener('mousemove', onMouseMove)

    let animId
    const tick = () => {
      animId = requestAnimationFrame(tick)
      controls.update()

      const pinEntries = [...pinMeshMapRef.current.entries()]
      let nowHoveredId = null

      if (pinEntries.length > 0) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const hits = raycasterRef.current.intersectObjects(pinEntries.map(([, { head }]) => head))
        if (hits.length > 0) {
          const hitMesh = hits[0].object
          for (const [id, { head }] of pinEntries) {
            if (head === hitMesh) { nowHoveredId = id; break }
          }
        }
      }

      if (nowHoveredId !== hoveredIdRef.current) {
        hoveredIdRef.current = nowHoveredId
        setHoveredPinId(nowHoveredId)
        mount.style.cursor = nowHoveredId ? 'pointer' : 'crosshair'
        const audio = audioRef.current
        if (audio) {
          clearInterval(audioFadeRef.current)
          if (nowHoveredId) {
            const pin = pinsRef.current.find((p) => p.id === nowHoveredId)
            if (pin?.track?.previewUrl) {
              audio.src = pin.track.previewUrl
              audio.volume = 0
              audio.currentTime = 0
              audio.play().catch(() => {})
              audioFadeRef.current = setInterval(() => {
                if (audio.volume >= 1) {
                  clearInterval(audioFadeRef.current)
                } else {
                  audio.volume = Math.min(1, audio.volume + 0.08)
                }
              }, 30)
            } else {
              audio.src = ''
            }
          } else {
            audioFadeRef.current = setInterval(() => {
              if (audio.volume <= 0.01) {
                audio.volume = 0
                audio.pause()
                audio.src = ''
                clearInterval(audioFadeRef.current)
              } else {
                audio.volume = Math.max(0, audio.volume - 0.08)
              }
            }, 30)
          }
        }
      }

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(audioFadeRef.current)
      window.removeEventListener('resize', onResize)
      mount.removeEventListener('mousemove', onMouseMove)
      controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  const placePendingPin = (normal, color) => {
    const scene = sceneRef.current
    if (!scene) return
    if (pendingPinMeshRef.current) scene.remove(pendingPinMeshRef.current)
    const { group } = createPinMesh(color)
    group.position.copy(normal.clone().multiplyScalar(RADIUS))
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
    scene.add(group)
    pendingPinMeshRef.current = group
  }

  const removePendingPin = () => {
    if (pendingPinMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(pendingPinMeshRef.current)
      pendingPinMeshRef.current = null
    }
  }

  const handleGlobeClick = (e) => {
    const mount = mountRef.current
    const camera = cameraRef.current
    const earth = earthRef.current
    if (!mount || !camera || !earth) return

    const rect = mount.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera({ x, y }, camera)
    const hits = raycasterRef.current.intersectObject(earth)
    if (hits.length === 0) return

    const normal = hits[0].point.clone().normalize()
    const color = randomPinColor()
    pendingNormalRef.current = normal
    pendingColorRef.current = color
    placePendingPin(normal, color)
    setIsPending(true)
    setPinError(null)
  }

  const cancelPin = () => {
    removePendingPin()
    pendingNormalRef.current = null
    pendingColorRef.current = null
    setIsPending(false)
    setQuery('')
    setResults(null)
    setSelectedTrack(null)
    setPinError(null)
  }

  const onPointerDown = (e) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e) => {
    if (!pointerDownRef.current) return
    const dx = e.clientX - pointerDownRef.current.x
    const dy = e.clientY - pointerDownRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) < 8) handleGlobeClick(e)
    pointerDownRef.current = null
  }

  const search = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setResults(null)
    setSelectedTrack(null)
    try {
      const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setResults(data.tracks ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const pickTrack = (track) => {
    setSelectedTrack(track)
    setResults(null)
  }

  const confirmPin = async () => {
    const normal = pendingNormalRef.current
    const color = pendingColorRef.current
    if (!normal || !selectedTrack || !userName.trim() || confirming) return

    setConfirming(true)
    setPinError(null)
    try {
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName.trim(),
          color,
          track: {
            title: selectedTrack.title,
            artist: selectedTrack.artist,
            previewUrl: selectedTrack.previewUrl || null,
            image: selectedTrack.image || '',
          },
          normal: { x: normal.x, y: normal.y, z: normal.z },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `server error ${res.status}`)
      }
      const { pin } = await res.json()
      removePendingPin()
      const newPins = [...pinsRef.current, pin]
      setPins(newPins)
      pinsRef.current = newPins
      setIsPending(false)
      setQuery('')
      setResults(null)
      setSelectedTrack(null)
    } catch (err) {
      setPinError(err.message || 'could not place pin — try again')
    } finally {
      setConfirming(false)
    }
  }

  const pinCount = pins.length

  return (
    <div className="globe-wrap">
      <div
        className="globe-canvas"
        ref={mountRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {displayedPin && (
          <div className={`globe-pin-card${cardVisible ? ' globe-pin-card--visible' : ''}`}>
            <span className="globe-pin-card-name">{displayedPin.name}</span>
            <span className="globe-pin-card-label">is listening to</span>
            <strong className="globe-pin-card-track">{displayedPin.track.title}</strong>
            <span className="globe-pin-card-artist">{displayedPin.track.artist}</span>
          </div>
        )}
      </div>
      <p className="globe-hint">
        {isPending
          ? 'fill in the details below  //  drag to spin  //  scroll to zoom'
          : pinCount > 0
          ? `${pinCount} pin${pinCount !== 1 ? 's' : ''}  //  hover a pin to hear the preview  //  click to add yours`
          : 'click the globe to drop a pin  //  drag to spin  //  scroll to zoom'}
      </p>
      {isPending && (
        <div className="globe-search">
          <div className="globe-name-row">
            <input
              className="globe-search-input globe-name-input"
              onChange={(e) => setUserName(e.target.value)}
              placeholder="your name"
              value={userName}
            />
            <button className="globe-cancel-btn" onClick={cancelPin} type="button">×</button>
          </div>
          <form className="globe-search-form" onSubmit={search}>
            <input
              className="globe-search-input"
              disabled={searching}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="what are you listening to?"
              value={query}
            />
            <button className="globe-search-btn" disabled={searching || !query.trim()} type="submit">
              {searching ? '...' : 'search'}
            </button>
          </form>
          {results !== null && !selectedTrack && (
            results.length === 0 ? (
              <p className="globe-no-results">no tracks found</p>
            ) : (
              <ul className="globe-results">
                {results.map((t, i) => (
                  <li key={i}>
                    <button className="globe-result-item" onClick={() => pickTrack(t)}>
                      <span className="globe-result-title">{t.title}</span>
                      <span className="globe-result-meta">
                        {t.artist}{!t.previewUrl && ' · no preview'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
          {selectedTrack && (
            <div className="globe-track">
              {selectedTrack.image && (
                <img alt="" className="globe-track-art" src={selectedTrack.image} />
              )}
              <div className="globe-track-info">
                <p className="small-label">selected</p>
                <strong className="globe-track-title">{selectedTrack.title}</strong>
                <p className="globe-track-artist">{selectedTrack.artist}</p>
              </div>
              <button
                className="globe-change-btn"
                onClick={() => { setSelectedTrack(null); setResults(null) }}
              >
                change
              </button>
            </div>
          )}
          {pinError && <p className="globe-pin-error">{pinError}</p>}
          <div className="globe-confirm-row">
            <button
              className="globe-confirm-btn"
              disabled={!selectedTrack || !userName.trim() || confirming}
              onClick={confirmPin}
            >
              {confirming ? 'placing...' : 'place pin'}
            </button>
          </div>
        </div>
      )}
      <audio ref={audioRef} />
    </div>
  )
}
