import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Dandelion from './Dandelion'
import Fireflies from './Fireflies'
import PostItBoard from './PostItBoard'

function useAdminPassword() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('admin_pw') || '')
  const save = (pw) => { sessionStorage.setItem('admin_pw', pw); setPassword(pw) }
  const clear = () => { sessionStorage.removeItem('admin_pw'); setPassword('') }
  return [password, save, clear]
}

function authHeaders(password) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }
}

function PasswordGate({ onAuth }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(false)
    const res = await fetch('/api/auth-check', {
      method: 'POST',
      headers: authHeaders(input),
    })
    if (res.status === 401) { setError(true); return }
    onAuth(input)
  }

  return (
    <div className="admin-gate">
      <p className="small-label">admin access</p>
      <form className="admin-gate-form" onSubmit={submit}>
        <input
          autoFocus
          onChange={(e) => setInput(e.target.value)}
          placeholder="password"
          required
          type="password"
          value={input}
        />
        <button type="submit">enter</button>
      </form>
      {error && <p className="admin-error">wrong password</p>}
    </div>
  )
}

const FORMAT_BTNS = [
  { label: 'B',  title: 'Bold',          before: '**',   after: '**'   },
  { label: 'I',  title: 'Italic',         before: '*',    after: '*'    },
  { label: 'S',  title: 'Strikethrough',  before: '~~',   after: '~~'   },
  { label: '<>', title: 'Inline code',    before: '`',    after: '`'    },
  { label: '##', title: 'Heading',        before: '## ',  after: '',    line: true },
  { label: '❝',  title: 'Blockquote',    before: '> ',   after: '',    line: true },
  { label: '•',  title: 'Bullet list',   before: '- ',   after: '',    line: true },
  { label: '🌈', title: 'Rainbow text',  before: '[r]',  after: '[/r]' },
]

function FormatToolbar({ contentRef, value, onChange, password }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleImageFile = useCallback(async (e) => {
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Upload failed')
        return
      }
      const { url } = await res.json()
      const el = contentRef.current
      const pos = el ? el.selectionStart : value.length
      const insert = `![image](${url})`
      const newValue = value.slice(0, pos) + insert + value.slice(pos)
      onChange(newValue)
      requestAnimationFrame(() => {
        if (el) { el.focus(); el.setSelectionRange(pos + insert.length, pos + insert.length) }
      })
    } catch { alert('Upload failed') }
    setUploading(false)
    e.target.value = ''
  }, [contentRef, value, onChange, password])

  const apply = (before, after, line) => {
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd

    let newValue, newStart, newEnd

    if (line) {
      const selected = value.slice(start, end)
      if (selected.includes('\n')) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const prefixed = value.slice(lineStart, end).split('\n').map((l) => before + l).join('\n')
        newValue = value.slice(0, lineStart) + prefixed + value.slice(end)
        newStart = start + before.length
        newEnd = start + prefixed.length
      } else {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        newValue = value.slice(0, lineStart) + before + value.slice(lineStart)
        newStart = start + before.length
        newEnd = end + before.length
      }
    } else {
      const sel = value.slice(start, end) || 'text'
      newValue = value.slice(0, start) + before + sel + after + value.slice(end)
      newStart = start + before.length
      newEnd = newStart + sel.length
    }

    onChange(newValue)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newStart, newEnd)
    })
  }

  return (
    <div className="format-toolbar">
      {FORMAT_BTNS.map((btn) => (
        <button
          className="format-toolbar-btn"
          key={btn.label}
          onClick={() => apply(btn.before, btn.after, btn.line)}
          title={btn.title}
          type="button"
        >
          {btn.label}
        </button>
      ))}
      <span className="format-toolbar-sep" aria-hidden="true" />
      <input
        accept="image/png,image/jpeg,image/gif"
        hidden
        onChange={handleImageFile}
        ref={fileInputRef}
        type="file"
      />
      <button
        className="format-toolbar-btn"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        title="Insert image (PNG, JPEG, GIF — max 5 MB)"
        type="button"
      >
        {uploading ? '...' : 'IMG'}
      </button>
    </div>
  )
}

function DiaryAdmin({ password }) {
  const [entries, setEntries] = useState([])
  const [fields, setFields] = useState({ date: '', title: '', content: '', listeningTo: '' })
  const [submitStatus, setSubmitStatus] = useState('idle')
  const contentRef = useRef(null)

  useEffect(() => {
    fetch('/api/diary').then((r) => r.json()).then((d) => setEntries(Array.isArray(d) ? d : []))
  }, [])

  const handleChange = (e) => setFields((p) => ({ ...p, [e.target.name]: e.target.value }))
  const setContent = (val) => setFields((p) => ({ ...p, content: val }))

  const create = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: authHeaders(password),
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      const entry = await res.json()
      setEntries((p) => [entry, ...p])
      setFields({ date: '', title: '', content: '', listeningTo: '' })
      setSubmitStatus('idle')
    } catch { setSubmitStatus('error') }
  }

  const remove = async (id) => {
    await fetch('/api/diary', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setEntries((p) => p.filter((e) => e.id !== id))
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">diary entries</div>

      <form className="admin-form" onSubmit={create}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label>date</label>
            <input name="date" onChange={handleChange} placeholder="07.05.2026" required type="text" value={fields.date} />
          </div>
          <div className="admin-field">
            <label>listening to</label>
            <input name="listeningTo" onChange={handleChange} placeholder="Track - Artist" type="text" value={fields.listeningTo} />
          </div>
        </div>
        <div className="admin-field">
          <label>title</label>
          <input name="title" onChange={handleChange} placeholder="entry title" required type="text" value={fields.title} />
        </div>
        <div className="admin-field">
          <label>content</label>
          <FormatToolbar contentRef={contentRef} value={fields.content} onChange={setContent} password={password} />
          <textarea
            name="content"
            onChange={handleChange}
            placeholder="write your entry..."
            ref={contentRef}
            required
            rows={8}
            value={fields.content}
          />
        </div>
        {submitStatus === 'error' && <p className="admin-error">something went wrong</p>}
        <button className="admin-submit" disabled={submitStatus === 'sending'} type="submit">
          {submitStatus === 'sending' ? 'posting...' : 'post entry'}
        </button>
      </form>

      <div className="admin-list">
        {entries.map((e) => (
          <div className="admin-list-item" key={e.id}>
            <div>
              <span className="admin-list-date">{e.date}</span>
              <span className="admin-list-label">{e.title}</span>
            </div>
            <button className="admin-delete" onClick={() => remove(e.id)} type="button">delete</button>
          </div>
        ))}
        {entries.length === 0 && <p className="admin-empty">no entries yet</p>}
      </div>
    </div>
  )
}

function PostItsAdmin({ password }) {
  const [notes, setNotes] = useState([])

  useEffect(() => {
    fetch('/api/post-its').then((r) => r.json()).then((d) => setNotes(Array.isArray(d) ? d : []))
  }, [])

  const remove = async (id) => {
    await fetch('/api/post-its', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setNotes((p) => p.filter((n) => n.id !== id))
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">post-its ({notes.length})</div>
      <div className="admin-list">
        {notes.map((n) => (
          <div className="admin-list-item" key={n.id}>
            <div>
              <span className="admin-list-label">{n.name}</span>
              <span className="admin-list-preview">{n.message}</span>
            </div>
            <button className="admin-delete" onClick={() => remove(n.id)} type="button">delete</button>
          </div>
        ))}
        {notes.length === 0 && <p className="admin-empty">no notes</p>}
      </div>
    </div>
  )
}

function PostItBoardAdmin({ password }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-title">post-its — arrange</div>
      <PostItBoard password={password} />
    </div>
  )
}

function MoodAdmin({ password }) {
  const [mood, setMood] = useState('')
  const [submitStatus, setSubmitStatus] = useState('idle')

  useEffect(() => {
    fetch('/api/mood')
      .then((r) => r.json())
      .then((d) => { if (d.mood) setMood(d.mood) })
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: authHeaders(password),
        body: JSON.stringify({ mood }),
      })
      if (!res.ok) throw new Error()
      setSubmitStatus('saved')
      setTimeout(() => setSubmitStatus('idle'), 2000)
    } catch { setSubmitStatus('error') }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">mood</div>
      <form className="admin-form" onSubmit={save}>
        <div className="admin-field">
          <label>current mood</label>
          <input
            maxLength={120}
            onChange={(e) => setMood(e.target.value)}
            placeholder="like sitting in a cafe on a friday night"
            required
            type="text"
            value={mood}
          />
        </div>
        {submitStatus === 'error' && <p className="admin-error">something went wrong</p>}
        <button className="admin-submit" disabled={submitStatus === 'sending'} type="submit">
          {submitStatus === 'saved' ? 'saved!' : submitStatus === 'sending' ? 'saving...' : 'update mood'}
        </button>
      </form>
    </div>
  )
}

function LinksAdmin({ password }) {
  const [links, setLinks] = useState([])
  const [fields, setFields] = useState({ label: '', href: '' })
  const [submitStatus, setSubmitStatus] = useState('idle')

  useEffect(() => {
    fetch('/api/links').then((r) => r.json()).then((d) => setLinks(Array.isArray(d) ? d : []))
  }, [])

  const handleChange = (e) => setFields((p) => ({ ...p, [e.target.name]: e.target.value }))

  const create = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: authHeaders(password),
        body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error()
      const link = await res.json()
      setLinks((p) => [...p, link])
      setFields({ label: '', href: '' })
      setSubmitStatus('idle')
    } catch { setSubmitStatus('error') }
  }

  const remove = async (id) => {
    await fetch('/api/links', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setLinks((p) => p.filter((l) => l.id !== id))
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">links</div>

      <form className="admin-form" onSubmit={create}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label>label</label>
            <input name="label" onChange={handleChange} placeholder="jjdebastos.com" required type="text" value={fields.label} />
          </div>
          <div className="admin-field">
            <label>url</label>
            <input name="href" onChange={handleChange} placeholder="https://..." required type="url" value={fields.href} />
          </div>
        </div>
        {submitStatus === 'error' && <p className="admin-error">something went wrong</p>}
        <button className="admin-submit" disabled={submitStatus === 'sending'} type="submit">
          {submitStatus === 'sending' ? 'adding...' : 'add link'}
        </button>
      </form>

      <div className="admin-list">
        {links.map((l) => (
          <div className="admin-list-item" key={l.id}>
            <div>
              <span className="admin-list-label">{l.label}</span>
              <span className="admin-list-preview">{l.href}</span>
            </div>
            <button className="admin-delete" onClick={() => remove(l.id)} type="button">delete</button>
          </div>
        ))}
        {links.length === 0 && <p className="admin-empty">no links yet</p>}
      </div>
    </div>
  )
}

function PinsAdmin({ password }) {
  const [pins, setPins] = useState([])

  useEffect(() => {
    fetch('/api/pins').then((r) => r.json()).then((d) => setPins(Array.isArray(d.pins) ? d.pins : []))
  }, [])

  const remove = async (id) => {
    await fetch('/api/pins', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setPins((p) => p.filter((pin) => pin.id !== id))
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">globe pins ({pins.length})</div>
      <div className="admin-list">
        {pins.map((pin) => (
          <div className="admin-list-item" key={pin.id}>
            <div>
              <span className="admin-list-label">{pin.name}</span>
              <span className="admin-list-preview">{pin.track.title} — {pin.track.artist}</span>
            </div>
            <button className="admin-delete" onClick={() => remove(pin.id)} type="button">delete</button>
          </div>
        ))}
        {pins.length === 0 && <p className="admin-empty">no pins yet</p>}
      </div>
    </div>
  )
}

function ChalkboardAdmin({ password }) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    fetch('/api/chalkboard').then((r) => r.json()).then((d) => setEntries(Array.isArray(d) ? d : []))
  }, [])

  const remove = async (id) => {
    await fetch('/api/chalkboard', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({ id }),
    })
    setEntries((p) => p.filter((e) => e.id !== id))
  }

  const clearAll = async () => {
    if (!window.confirm('Clear the entire chalkboard? This cannot be undone.')) return
    await fetch('/api/chalkboard', {
      method: 'DELETE',
      headers: authHeaders(password),
      body: JSON.stringify({}),
    })
    setEntries([])
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">chalkboard ({entries.length} drawings)</div>
      {entries.length > 0 && (
        <button className="admin-submit admin-danger" onClick={clearAll} type="button">clear entire board</button>
      )}
      <div className="admin-list">
        {entries.map((e) => (
          <div className="admin-list-item" key={e.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {e.imageData && (
                <img
                  alt=""
                  src={e.imageData}
                  style={{ width: 60, height: 34, objectFit: 'cover', border: '1px solid rgba(109,138,82,0.3)', flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <span className="admin-list-label">{e.name}</span>
                <span className="admin-list-preview">
                  {e.imageData ? `${e.w}×${e.h} @ (${e.x}, ${e.y})` : `${e.strokes?.length ?? 0} strokes`}
                </span>
              </div>
            </div>
            <button className="admin-delete" onClick={() => remove(e.id)} type="button">delete</button>
          </div>
        ))}
        {entries.length === 0 && <p className="admin-empty">board is empty</p>}
      </div>
    </div>
  )
}

export default function Admin() {
  const [password, savePassword, clearPassword] = useAdminPassword()
  const [authed, setAuthed] = useState(!!password)

  const onAuth = (pw) => { savePassword(pw); setAuthed(true) }
  const logout = () => { clearPassword(); setAuthed(false) }

  return (
    <main className="min-h-screen overflow-hidden px-3 py-6 text-[#d7e1c2] sm:px-6 lg:flex lg:items-start lg:px-8">
      <Fireflies />
      <div className="fixed bottom-0 right-[-18vw] top-0 w-[58vw] min-w-105 pointer-events-none opacity-38">
        <Dandelion />
      </div>

      <section className="blog-shell relative z-10 mx-auto w-full max-w-3xl">
        <article className="retro-panel main-window">
          <div className="window-bar">
            <span>admin.exe</span>
            <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
          </div>

          <header className="blog-hero">
            <p className="eyebrow">restricted area</p>
            <h2>Admin</h2>
            <div className="ticker"><span>manage your site</span></div>
          </header>

          <div className="admin-body">
            {!authed ? (
              <PasswordGate onAuth={onAuth} />
            ) : (
              <>
                <DiaryAdmin password={password} />
                <PostItBoardAdmin password={password} />
                <MoodAdmin password={password} />
                <LinksAdmin password={password} />
                <PostItsAdmin password={password} />
                <PinsAdmin password={password} />
                <ChalkboardAdmin password={password} />
                <div className="admin-footer">
                  <button className="admin-logout" onClick={logout} type="button">log out</button>
                </div>
              </>
            )}
          </div>

          <div className="contact-back">
            <Link className="entry-link-button" to="/">← back home</Link>
          </div>
        </article>
      </section>
    </main>
  )
}
