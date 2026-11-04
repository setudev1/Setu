import AnimatedButton from '@/components/ui/animated-button'
import { useCallback, useEffect, useState } from 'react'
import { CloseIcon } from './icons'

type Review = { id: number; name: string; stars: number; text: string; at: number; url: string }
type Props = { open: boolean; onClose: () => void }

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n)
const REFRESH_MS = 60_000

// Live reviews. They come from public GitHub issues, so anyone can read them and anyone with a GitHub account can write one.
export default function ReviewsModal({ open, onClose }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'offline'>('loading')
  const [updated, setUpdated] = useState(0)
  const [filter, setFilter] = useState<'all' | 'good' | 'low'>('all')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    void window.setu.reviews
      .list()
      .then((r) => {
        if (r.ok) {
          setReviews(r.reviews)
          setUpdated(r.fetchedAt)
          setState('ok')
        } else setState((s) => (s === 'ok' ? 'ok' : 'offline'))
      })
      .catch(() => setState((s) => (s === 'ok' ? 'ok' : 'offline')))
  }, [])

  // Live: load when opened, then every minute while it stays open.
  useEffect(() => {
    if (!open) return
    setState('loading')
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(t)
  }, [open, load])

  if (!open) return null

  const count = reviews.length
  const avg = count ? reviews.reduce((a, r) => a + r.stars, 0) / count : 0
  const good = reviews.filter((r) => r.stars >= 4)
  const low = reviews.filter((r) => r.stars <= 3)
  const shown = filter === 'good' ? good : filter === 'low' ? low : reviews

  function post(): void {
    if (!rating) return setNote('Pick a star rating first.')
    setNote('Opening GitHub. Press "Submit new issue" there to post it. Your review shows here within a minute.')
    void window.setu.reviews.write(rating, text)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal reviews-modal" role="dialog" aria-label="Reviews" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            Reviews{' '}
            <span className={`live-dot ${state === 'ok' ? 'on' : ''}`} title={state === 'ok' ? 'Live' : state === 'loading' ? 'Loading' : 'Offline'} />
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close reviews"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="rv-summary">
            <div>
              <div className="rv-avg">{count ? avg.toFixed(1) : '–'}</div>
              <div className="rv-stars" aria-hidden="true">{count ? stars(Math.round(avg)) : ''}</div>
              <div className="dim">{count ? `${count} review${count === 1 ? '' : 's'}` : state === 'loading' ? 'Loading…' : 'No reviews yet'}</div>
            </div>
            <div className="rv-bars">
              {[5, 4, 3, 2, 1].map((s) => {
                const k = reviews.filter((r) => r.stars === s).length
                return (
                  <div key={s} className={`rv-bar ${s <= 3 ? 'low' : ''}`}>
                    <span>{s}★</span>
                    <div className="rv-track"><div className="rv-fill" style={{ width: `${count ? Math.round((k * 100) / count) : 0}%` }} /></div>
                    <span>{k}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {state === 'offline' && <p className="msg-error">Could not load reviews. Check your internet. This page tries again every minute.</p>}
          {state === 'ok' && <p className="dim rv-updated">Updated {new Date(updated).toLocaleTimeString()} · refreshes every minute</p>}

          <div className="rv-tabs" role="group" aria-label="Show">
            <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All {count}</button>
            <button className="chip" aria-pressed={filter === 'good'} onClick={() => setFilter('good')}>Good {good.length}</button>
            <button className="chip" aria-pressed={filter === 'low'} onClick={() => setFilter('low')}>Needs improvement {low.length}</button>
          </div>

          <div className="rv-list">
            {shown.length === 0 && state !== 'loading' && (
              <p className="dim">
                {filter === 'low' ? 'Nothing here yet. If something did not work for you, tell us below.' : 'No reviews here yet. Be the first to write one.'}
              </p>
            )}
            {shown.map((r) => (
              <article key={r.id} className="rv-card">
                <div className="rv-top">
                  <strong>{r.name}</strong>
                  <span className="rv-stars" aria-label={`${r.stars} out of 5 stars`}>{stars(r.stars)}</span>
                </div>
                {r.text && <p>{r.text}</p>}
                <span className="dim rv-when">{r.at ? new Date(r.at).toLocaleDateString() : ''}</span>
              </article>
            ))}
          </div>

          <h3>Write a review</h3>
          <p className="dim">Reviews are public and shown with your GitHub name. You need a free GitHub account to post.</p>
          <div className="rv-pick" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
            ))}
          </div>
          <textarea className="rv-text" value={text} maxLength={600} onChange={(e) => setText(e.target.value)} placeholder="What was good, and what should be better?" aria-label="Your review" />
          <div className="add-row">
            <AnimatedButton size="sm" onClick={post}>Post on GitHub</AnimatedButton>
            {note && <span className="dim" role="status">{note}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
