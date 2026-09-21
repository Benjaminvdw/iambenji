import { Link } from 'react-router-dom'
import DiaryFeed from './DiaryFeed'
import Fireflies from './Fireflies'

export default function DiaryPage() {
  return (
    <main className="min-h-screen px-3 py-6 text-[#d7e1c2] sm:px-6 lg:px-8">
      <Fireflies />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <div className="retro-panel">
          <div className="window-bar">
            <span>diary.html</span>
            <div className="window-dots" aria-hidden="true">
              <i /><i /><i />
            </div>
          </div>
          <header className="blog-hero">
            <p className="eyebrow">all entries</p>
            <h2>Diary</h2>
            <div className="ticker"><span>every thought that made it to the page</span></div>
          </header>
          <DiaryFeed />
        </div>
        <Link className="diary-back-link" to="/">← back home</Link>
      </div>
    </main>
  )
}
