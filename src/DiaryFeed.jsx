import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

function RainbowText({ children }) {
  const text = [children].flat().map((c) => (typeof c === 'string' ? c : '')).join('')
  return (
    <span className="rainbow-wrap">
      {[...text].map((char, i) => (
        <span
          key={i}
          className="rainbow-char"
          style={{ animationDelay: `${-(i * 0.15) % 2.5}s` }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

const MD_COMPONENTS = { rainbow: RainbowText }

function renderContent(raw) {
  const processed = raw
    .replace(/\[r\]([\s\S]*?)\[\/r\]/g, '<rainbow>$1</rainbow>')
    .replace(/\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
  return (
    <ReactMarkdown
      components={MD_COMPONENTS}
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkGfm]}
    >
      {processed}
    </ReactMarkdown>
  )
}

export default function DiaryFeed({ limit }) {
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/diary')
      .then((r) => r.json())
      .then((data) => { setEntries(Array.isArray(data) ? data : []); setStatus('ready') })
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'loading') {
    return (
      <div className="diary-feed">
        <p className="diary-feed-empty">loading entries...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="diary-feed">
        <p className="diary-feed-empty">could not load entries</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="diary-feed">
        <p className="diary-feed-empty">no entries yet</p>
      </div>
    )
  }

  const visible = limit ? entries.slice(0, limit) : entries
  const hasMore = limit && entries.length > limit

  return (
    <div className="diary-feed">
      {visible.map((entry) => (
        <article className="diary-entry" key={entry.id}>
          <div className="diary-entry-meta">
            <time className="diary-entry-date">{entry.date}</time>
          </div>
          <h3 className="diary-entry-title">{entry.title}</h3>
          <div className="diary-entry-body diary-md">
            {renderContent(entry.content)}
          </div>
          {entry.listeningTo && (
            <p className="diary-entry-listening">&#9834; {entry.listeningTo}</p>
          )}
        </article>
      ))}
      {hasMore && (
        <Link className="diary-see-all" to="/diary">
          see all {entries.length} entries →
        </Link>
      )}
    </div>
  )
}
