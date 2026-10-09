function MusicReviewsAdmin({ password }) {
  const [reviews, setReviews] = useState([])
  const [fields, setFields] = useState({ artist: '', album: '', rating: '', description: '', image: '' })
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [uploading, setUploading] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch('/api/music-reviews').then((r) => r.json()).then((d) => setReviews(Array.isArray(d) ? d : []))
  }, [])

  const handleChange = (e) => setFields((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleImageFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${password}` },
        body: fd,
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      setFields((p) => ({ ...p, image: url }))
    } catch { alert('Upload failed') }
    setUploading(false)
    e.target.value = ''
  }

  const create = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/music-reviews', {
        method: 'POST',
        headers: authHeaders(password),
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      const entry = await res.json()
      setReviews((p) => [entry, ...p])
      setFields({ artist: '', album: '', rating: '', description: '', image: '' })
      setSubmitStatus('idle')
    } catch { setSubmitStatus('error') }
  }

  const remove = async (id) => {
    await fetch('/api/music-reviews', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setReviews((p) => p.filter((e) => e.id !== id))
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.tracks) setSearchResults(data.tracks)
    } catch { }
    setSearching(false)
  }

  const selectResult = (item) => {
    setFields((p) => ({
      ...p,
      artist: item.artist,
      album: item.album || item.title,
      image: item.image,
    }))
    setSearchResults([])
    setSearchQuery('')
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">music reviews</div>

      {/* Spotify Search Bar */}
      <form className="admin-form" onSubmit={handleSearch} style={{ borderBottom: '1px solid #333', paddingBottom: 16, marginBottom: 16 }}>
        <div className="admin-field">
          <label>search spotify</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              name="searchQuery" 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="album or song name..." 
              type="text" 
              value={searchQuery} 
              style={{ flex: 1, minWidth: 0 }} 
            />
            <button className="admin-submit" disabled={searching} type="submit" style={{ flexShrink: 0, padding: '0 16px', marginTop: 0 }}>
              {searching ? '...' : 'SEARCH'}
            </button>
          </div>
        </div>
        
        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
            {searchResults.map((res, i) => (
              <div 
                key={i} 
                onClick={() => selectResult(res)}
                style={{ display: 'flex', gap: 12, padding: 8, backgroundColor: '#222', cursor: 'pointer', alignItems: 'center' }}
              >
                {res.image && <img src={res.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.title}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {res.type === 'album' ? 'Album' : 'Song'} • {res.artist}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </form>

      <form className="admin-form" onSubmit={create}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label>artist</label>
            <input name="artist" onChange={handleChange} placeholder="Artist Name" required type="text" value={fields.artist} />
          </div>
          <div className="admin-field">
            <label>album</label>
            <input name="album" onChange={handleChange} placeholder="Album Name" required type="text" value={fields.album} />
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label>rating (1-10)</label>
            <input name="rating" onChange={handleChange} placeholder="9.4" required type="number" step="0.1" min="1" max="10" value={fields.rating} />
          </div>
          <div className="admin-field">
            <label>image url</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input name="image" onChange={handleChange} placeholder="/api/images/..." type="text" value={fields.image} style={{ flex: 1, minWidth: 0 }} />
              <input accept="image/png,image/jpeg,image/gif" hidden onChange={handleImageFile} ref={fileInputRef} type="file" />
              <button className="admin-submit" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button" style={{ flexShrink: 0, padding: '0 10px', marginTop: 0 }}>
                {uploading ? '...' : 'UPLOAD'}
              </button>
            </div>
          </div>
        </div>
        <div className="admin-field">
          <label>description</label>
          <textarea
            name="description"
            onChange={handleChange}
            placeholder="what do you think of this album?"
            required
            rows={4}
            value={fields.description}
          />
        </div>
        {submitStatus === 'error' && <p className="admin-error">something went wrong</p>}
        <button className="admin-submit" disabled={submitStatus === 'sending'} type="submit">
          {submitStatus === 'sending' ? 'adding...' : 'add review'}
        </button>
      </form>

      <div className="admin-list">
        {reviews.map((r) => (
          <div className="admin-list-item" key={r.id}>
            <div>
              <span className="admin-list-label">{r.album} by {r.artist}</span>
              <span className="admin-list-preview">{r.rating}/10</span>
            </div>
            <button className="admin-delete" onClick={() => remove(r.id)} type="button">delete</button>
          </div>
        ))}
        {reviews.length === 0 && <p className="admin-empty">no reviews yet</p>}
      </div>
    </div>
  )
}
