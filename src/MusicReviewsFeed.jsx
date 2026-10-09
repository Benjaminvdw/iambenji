import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'

function CircleDiagram({ rating }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (rating / 10) * circumference
  return (
    <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="56" height="56" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="4" fill="none" opacity="0.2" />
        <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{rating}</span>
    </div>
  )
}

function ShareModal({ review, onClose }) {
  const [theme, setTheme] = useState('retro')
  const [previewData, setPreviewData] = useState(null)
  const nodeRef = useRef(null)

  useEffect(() => {
    if (!nodeRef.current) return
    let isCancelled = false
    const renderPreview = async () => {
      setPreviewData(null)
      await new Promise(r => setTimeout(r, 200)) // give images a tick to render
      if (isCancelled) return
      try {
        const canvas = await html2canvas(nodeRef.current, { backgroundColor: null, useCORS: true })
        if (!isCancelled) setPreviewData(canvas.toDataURL('image/png'))
      } catch (err) {
        console.error(err)
      }
    }
    renderPreview()
    return () => { isCancelled = true }
  }, [theme, review])

  let bg = '#111', fg = '#fff', border = '1px solid #333', font = 'sans-serif'
  if (theme === 'light') { bg = '#fff'; fg = '#111'; border = '1px solid #ddd' }
  else if (theme === 'retro') { bg = '#394b39'; fg = '#d7e1c2'; border = '2px inset rgba(215, 225, 194, 0.4)'; font = '"Courier New", Courier, monospace' }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'sans-serif'
    }} onClick={onClose}>
      <div style={{ backgroundColor: '#222', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500, width: '100%', border: '2px solid #555' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
          <h3 style={{ margin: 0 }}>Share Review</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTheme('retro')} style={{ flex: 1, padding: 8, background: theme === 'retro' ? '#555' : '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>Website</button>
          <button onClick={() => setTheme('dark')} style={{ flex: 1, padding: 8, background: theme === 'dark' ? '#555' : '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>Dark</button>
          <button onClick={() => setTheme('light')} style={{ flex: 1, padding: 8, background: theme === 'light' ? '#555' : '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>Light</button>
        </div>
        
        {/* Hidden render target */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <div ref={nodeRef} style={{ width: 400, backgroundColor: bg, color: fg, fontFamily: font, padding: 24, boxSizing: 'border-box', borderRadius: theme === 'retro' ? 0 : 12, border: border, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {review.image && <img src={review.image} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: theme === 'retro' ? 0 : 8 }} crossOrigin="anonymous" />}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{review.album}</h3>
                <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>{review.artist}</p>
              </div>
              <CircleDiagram rating={review.rating} />
            </div>
            <blockquote style={{ margin: 0, fontStyle: 'italic', fontSize: '16px', borderLeft: `4px solid ${fg}`, paddingLeft: 12 }}>
              "{review.description}"
            </blockquote>
            <div style={{ fontSize: '12px', opacity: 0.6, textAlign: 'right', marginTop: 12 }}>
              iambenji.com
            </div>
          </div>
        </div>

        {/* Preview image */}
        <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 20, overflow: 'hidden' }}>
          {previewData ? <img src={previewData} style={{ maxWidth: '100%', height: 'auto' }} /> : <p style={{ color: '#fff' }}>Generating...</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={previewData} download={`${review.album}-review.png`} style={{ flex: 1, textAlign: 'center', padding: 12, background: '#4CAF50', color: '#fff', textDecoration: 'none', cursor: 'pointer', opacity: previewData ? 1 : 0.5, pointerEvents: previewData ? 'auto' : 'none' }}>Download Image</a>
        </div>
      </div>
    </div>
  )
}

export default function MusicReviewsFeed() {
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('loading')
  const [shareReview, setShareReview] = useState(null)

  useEffect(() => {
    fetch('/api/music-reviews')
      .then((r) => r.json())
      .then((data) => { setReviews(Array.isArray(data) ? data : []); setStatus('ready') })
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'loading') return <div className="diary-feed"><p className="diary-feed-empty">loading reviews...</p></div>
  if (status === 'error') return <div className="diary-feed"><p className="diary-feed-empty">could not load reviews</p></div>
  if (reviews.length === 0) return <div className="diary-feed"><p className="diary-feed-empty">no reviews yet</p></div>

  return (
    <div className="diary-feed">
      {reviews.map((r) => (
        <article className="diary-entry" key={r.id}>
          <div className="diary-entry-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <time className="diary-entry-date">{r.date}</time>
            <button onClick={() => setShareReview(r)} style={{ background: 'none', border: '1px solid currentColor', color: 'inherit', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', opacity: 0.8 }}>share</button>
          </div>
          
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12, marginBottom: 16 }}>
            {r.image && <img src={r.image} alt={r.album} style={{ width: 80, height: 80, objectFit: 'cover' }} crossOrigin="anonymous" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 className="diary-entry-title" style={{ margin: 0, wordBreak: 'break-word' }}>{r.album}</h3>
              <p style={{ margin: '4px 0 0 0', opacity: 0.8, wordBreak: 'break-word' }}>by {r.artist}</p>
            </div>
            <CircleDiagram rating={r.rating} />
          </div>

          <blockquote style={{ fontStyle: 'italic', borderLeft: '4px solid currentColor', paddingLeft: 12, margin: '16px 0', opacity: 0.9, whiteSpace: 'pre-wrap' }}>
            "{r.description}"
          </blockquote>
        </article>
      ))}

      {shareReview && <ShareModal review={shareReview} onClose={() => setShareReview(null)} />}
    </div>
  )
}
