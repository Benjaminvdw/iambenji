import { useState } from 'react'
import { Link } from 'react-router-dom'
import Dandelion from './Dandelion'
import Fireflies from './Fireflies'

export default function Contact() {
  const [fields, setFields] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('idle')

  const handleChange = (e) => {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!response.ok) throw new Error('Send failed')

      setStatus('sent')
      setFields({ name: '', email: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen overflow-hidden px-3 py-6 text-[#d7e1c2] sm:px-6 lg:flex lg:items-center lg:px-8">
      <Fireflies />
      <div className="fixed bottom-0 right-[-18vw] top-0 w-[58vw] min-w-105 pointer-events-none opacity-38">
        <Dandelion />
      </div>

      <section className="blog-shell relative z-10 mx-auto w-full max-w-2xl">
        <article className="retro-panel main-window">
          <div className="window-bar">
            <span>contact.html</span>
            <div className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>

          <header className="blog-hero">
            <p className="eyebrow">get in touch</p>
            <h2>Email me</h2>
            <div className="ticker">
              <span>send a message // i'll get back to you</span>
            </div>
          </header>

          <div className="entry-card">
            {status === 'sent' ? (
              <div className="contact-success">
                <p className="small-label">message sent</p>
                <p>Thanks for reaching out — I'll get back to you soon.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="contact-field">
                  <label htmlFor="name">name</label>
                  <input
                    id="name"
                    name="name"
                    onChange={handleChange}
                    placeholder="your name"
                    required
                    type="text"
                    value={fields.name}
                  />
                </div>

                <div className="contact-field">
                  <label htmlFor="email">email</label>
                  <input
                    id="email"
                    name="email"
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    type="email"
                    value={fields.email}
                  />
                </div>

                <div className="contact-field">
                  <label htmlFor="message">message</label>
                  <textarea
                    id="message"
                    name="message"
                    onChange={handleChange}
                    placeholder="say anything..."
                    required
                    rows={6}
                    value={fields.message}
                  />
                </div>

                {status === 'error' && (
                  <p className="contact-error">something went wrong — try again</p>
                )}

                <button className="visitor-button contact-submit" disabled={status === 'sending'} type="submit">
                  {status === 'sending' ? 'sending...' : 'send message'}
                </button>
              </form>
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
