import AnimatedButton from '@/components/ui/animated-button'
import type { ReactNode } from 'react'
import Logo from './Logo'
import { FolderIcon } from './icons'
import { timeAgo } from '../lib/sessions'
import type { SavedSession } from '../lib/sessions'
import { useState } from 'react'
import DailyChallenge from './DailyChallenge'

const QUICK = [
  // First-timer starters: complete requests that make one small page you can open in Preview.
  { label: 'Build a to-do app', text: 'Make a simple to-do list web page in one index.html file. Add, tick off and delete tasks, save them in the browser, and make it look clean and modern.' },
  { label: 'Build a calculator', text: 'Make a calculator web page in one index.html file with big buttons, keyboard support and a clean modern look.' },
  { label: 'Make my portfolio', text: 'Make a one-page personal portfolio in one index.html file with a hero section, about me, three project cards and a contact section. Ask me for my details first.' },
  { label: 'Fix a bug', text: 'I have a bug. Here is what happens and what I expected: ' },
  { label: 'Explain code', text: 'Explain this code to me in simple words, step by step: ' },
  { label: 'Write tests', text: 'Write simple tests for this code: ' },
  { label: 'Make it prettier', text: 'Make this page look cleaner and more modern: ' },
  { label: 'Add comments', text: 'Add short, helpful comments to this code: ' }
]

export default function Home({
  composer,
  banner,
  greeting,
  spaceName,
  onAddSpace,
  sessions,
  onOpenSession,
  onDeleteSession,
  onTour,
  onCommit,
  onRules
}: {
  composer: ReactNode
  banner?: ReactNode
  greeting?: string
  spaceName: string | null
  onAddSpace: () => void
  sessions: SavedSession[]
  onOpenSession: (id: string) => void
  onDeleteSession: (id: string) => void
  /** Sends the one-click project tour. Only offered when a project folder is chosen. */
  onTour?: () => void
  onCommit?: () => void
  onRules?: () => void
}) {
  const [all, setAll] = useState(false)
  const shown = all ? sessions : sessions.slice(0, 5)
  return (
    <div className="home">
      <div className="home-inner">
        <Logo size={112} />
        {greeting && <h1 className="greeting">Hello, {greeting}</h1>}
        {banner}
        {composer}
        <div className="quick-chips" role="group" aria-label="Quick starts">
          {spaceName && onTour && (
            <button className="chip quick-chip tour-chip" onClick={onTour} title="Setu reads your project and explains it in simple words">
              Tour my project
            </button>
          )}
          {spaceName && onCommit && (
            <button className="chip quick-chip" onClick={onCommit} title="Setu reads your changes and writes the commit message">
              Write commit message
            </button>
          )}
          {spaceName && onRules && (
            <button className="chip quick-chip" onClick={onRules} title="A SETU.md file with rules Setu follows in this project">
              Project rules
            </button>
          )}
          {spaceName && (
            <button className="chip quick-chip" onClick={() => window.dispatchEvent(new CustomEvent('setu:notes', { detail: '' }))} title="Things Setu remembers about this project">
              Notes
            </button>
          )}
          <button className="chip quick-chip" onClick={() => window.dispatchEvent(new CustomEvent('setu:reviews'))} title="See what people say about Setu, or write your own review">
            Reviews
          </button>
          <button className="chip quick-chip" onClick={() => window.dispatchEvent(new CustomEvent('setu:qa'))} title="Setu tries your app like a person: looks, clicks and types (beta)">
            Test like a person
          </button>
          <button className="chip quick-chip" onClick={() => window.dispatchEvent(new CustomEvent('setu:image'))} title="Make a picture with your free Cloudflare account">
            Make image
          </button>
          {QUICK.map((q) => (
            <button
              key={q.label}
              className="chip quick-chip"
              onClick={() => window.dispatchEvent(new CustomEvent('setu:prefill', { detail: q.text }))}
            >
              {q.label}
            </button>
          ))}
        </div>
        <DailyChallenge />
        {spaceName ? (
          <p className="space-hint">
            <FolderIcon size={15} />
            <span>
              Working in <strong>{spaceName}</strong>. Setu can create and change files here, and you approve every change.
            </span>
          </p>
        ) : (
          <p className="space-hint">
            Choose a project folder so Setu can create and edit files.
            <AnimatedButton size="sm" onClick={onAddSpace}>
              Choose a folder
            </AnimatedButton>
          </p>
        )}
        <section className="recent">
          <div className="recent-head">
            <span>Recent sessions</span>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-note">Your finished sessions show up here, so you can pick up where you left off.</div>
          ) : (
            <ul className="session-list">
              {shown.map((s) => (
                <li key={s.id} className="session-item">
                  <button className="session-open" onClick={() => onOpenSession(s.id)} title={s.title}>
                    <span className="session-title">{s.title}</span>
                    <span className="session-age">{timeAgo(s.updatedAt)}</span>
                  </button>
                  <button
                    className="icon-btn small session-del"
                    onClick={() => onDeleteSession(s.id)}
                    aria-label={`Delete session: ${s.title}`}
                    title="Delete this session"
                  >
                    ×
                  </button>
                </li>
              ))}
              {sessions.length > 5 && (
                <li>
                  <button className="link session-more" onClick={() => setAll((v) => !v)}>
                    {all ? 'Show fewer' : `View all ${sessions.length}`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
      <footer className="home-footer">Setu 0.1 (early build) · Ctrl+N new · Ctrl+K type · Ctrl+. preview · Ctrl+Shift+P commands</footer>
    </div>
  )
}
