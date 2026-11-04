import { useState } from 'react'
import { challengeOfDay, dayKey, loadProgress, markDone, streak } from '../lib/challenges'

// One small project a day for beginners. "Start" puts the request in the box; "I finished it" keeps the streak.
export default function DailyChallenge() {
  const today = dayKey()
  const c = challengeOfDay(today)
  const [progress, setProgress] = useState(() => loadProgress())
  const done = progress.done.includes(today)
  const days = streak(progress, today)
  return (
    <section className="daily" aria-label="Daily challenge">
      <div className="daily-top">
        <span className="daily-tag">Today's challenge</span>
        <span className={days > 0 ? 'daily-streak on' : 'daily-streak'} title="Days in a row you finished the challenge">
          {days > 0 ? `${days} day${days > 1 ? 's' : ''} in a row` : 'Start your streak'}
        </span>
      </div>
      <div className="daily-main">
        <div>
          <strong className="daily-title">{c.title}</strong>
          <span className={`daily-level lv-${c.level.toLowerCase()}`}>{c.level}</span>
        </div>
        <div className="daily-actions">
          <button className="chip quick-chip" onClick={() => window.dispatchEvent(new CustomEvent('setu:prefill', { detail: c.prompt }))}>
            Start
          </button>
          {done ? (
            <span className="installed">Done today ✓</span>
          ) : (
            <button className="chip quick-chip" onClick={() => setProgress(markDone(today))} title="Tick this when your page works">
              I finished it
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
