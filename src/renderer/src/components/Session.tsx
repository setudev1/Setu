import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { UiMessage } from '../types'
import MessageBody from './MessageBody'
import ChangeCard from './ChangeCard'
import LooseCodeSaver from './LooseCodeSaver'
import { parseFileBlocks } from '../lib/fileBlocks'
import { addLearned } from '../lib/learned'

type Handlers = {
  hasSpace: boolean
  onApply: (messageId: string, changes: { path: string; content: string }[]) => void
  onReject: (messageId: string) => void
  onUndo: (messageId: string) => void
}

function Feedback() {
  const [mode, setMode] = useState<'up' | 'down' | null>(null)
  const [text, setText] = useState('')
  const [done, setDone] = useState('')
  if (done) return <span className="feedback-done dim">{done}</span>
  function save() {
    const t = text.trim()
    if (t) addLearned(mode === 'up' ? `Keep doing this: ${t}` : t)
    setDone(t ? 'Learned. See Settings, "What Setu learned about you".' : 'Thanks.')
  }
  return (
    <span className="feedback">
      <button className={`link fb-btn${mode === 'up' ? ' on' : ''}`} aria-label="I liked this answer" onClick={() => setMode('up')}>
        👍
      </button>
      <button className={`link fb-btn${mode === 'down' ? ' on' : ''}`} aria-label="I did not like this answer" onClick={() => setMode('down')}>
        👎
      </button>
      {mode && (
        <span className="feedback-form">
          <input
            className="select-field"
            autoFocus
            maxLength={160}
            value={text}
            placeholder={mode === 'up' ? 'What did you like? (optional)' : 'What should Setu do differently next time?'}
            aria-label="Teach Setu"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="link" onClick={save}>
            Teach
          </button>
        </span>
      )}
    </span>
  )
}

const MessageView = memo(function MessageView({ m, busy, h }: { m: UiMessage; busy: boolean; h: Handlers }) {
  if (m.role === 'user') {
    return (
      <div className="msg user">
        {m.images && m.images.length > 0 && (
          <div className="bubble-pics">
            {m.images.map((src, i) => (
              <img key={i} src={src} alt={`Screenshot ${i + 1}`} />
            ))}
          </div>
        )}
        {!m.images?.length && m.hadImages ? <div className="bubble-note">Screenshot attached (not saved)</div> : null}
        <div className="bubble">{m.content}</div>
      </div>
    )
  }
  const finished = !busy && !m.error
  return (
    <div className="msg assistant">
      <div className="msg-label">{m.model ?? 'Setu'}</div>
      {m.content ? (
        <MessageBody text={m.content} />
      ) : busy ? (
        <p className="thinking">Thinking…</p>
      ) : null}
      {m.error && <p className="msg-error">{m.error}</p>}
      {m.stopped && <p className="msg-note">Stopped.</p>}
      {finished && m.content && (
        <ChangeCard
          text={m.content}
          proposal={m.proposal ?? { status: 'pending' }}
          hasSpace={h.hasSpace}
          onApply={(changes) => h.onApply(m.id, changes)}
          onReject={() => h.onReject(m.id)}
          onUndo={() => h.onUndo(m.id)}
        />
      )}
      {finished && m.content.includes('```') && parseFileBlocks(m.content).length === 0 && (
        <LooseCodeSaver
          text={m.content}
          proposal={m.proposal ?? { status: 'pending' }}
          hasSpace={h.hasSpace}
          onApply={(changes) => h.onApply(m.id, changes)}
          onReject={() => h.onReject(m.id)}
          onUndo={() => h.onUndo(m.id)}
        />
      )}
      {finished && h.hasSpace && m.content && (
        <button
          className="link remember-btn"
          title="Add the gist of this answer to the project notes"
          onClick={() => window.dispatchEvent(new CustomEvent('setu:notes', { detail: m.content.replace(/```[\s\S]*?```/g, '').trim().split(/\n+/)[0] }))}
        >
          Remember this
        </button>
      )}
      {finished && m.content && <Feedback />}
      {!busy && m.tokens !== undefined && (
        <div className="msg-meta">{m.tokens} tokens · local · free</div>
      )}
    </div>
  )
})

export default function Session({
  messages,
  streaming,
  composer,
  handlers
}: {
  messages: UiMessage[]
  streaming: boolean
  composer: ReactNode
  handlers: Handlers
}) {
  // Old messages do not need to redraw while a new one streams in. These handlers stay the same object between redraws.
  const hRef = useRef(handlers)
  hRef.current = handlers
  const stable = useMemo<Handlers>(
    () => ({
      hasSpace: handlers.hasSpace,
      onApply: (id, c) => hRef.current.onApply(id, c),
      onReject: (id) => hRef.current.onReject(id),
      onUndo: (id) => hRef.current.onUndo(id)
    }),
    [handlers.hasSpace]
  )
  const endRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true) // true while the reader is at the bottom, so new content keeps scrolling into view

  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  // Cards load their file contents after the reply ends and grow the page; keep following unless the reader scrolled up.
  useEffect(() => {
    const inner = innerRef.current
    if (!inner || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (stick.current) endRef.current?.scrollIntoView({ block: 'end' })
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  const [copied, setCopied] = useState(false)
  const chatMarkdown = (): string =>
    messages
      .map((m) => `**${m.role === 'user' ? 'You' : m.model || 'Setu'}:**\n\n${m.content}${m.hadImages || m.images?.length ? '\n\n_(screenshot attached)_' : ''}`)
      .join('\n\n---\n\n')
  function saveChat() {
    const blob = new Blob([chatMarkdown()], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `setu-chat-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  async function copyChat() {
    const md = chatMarkdown()
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard can be blocked; nothing to do */
    }
  }

  function onScroll() {
    const el = scrollerRef.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  return (
    <div className="session">
      <div className="messages" ref={scrollerRef} onScroll={onScroll}>
        <div className="messages-inner" ref={innerRef}>
          {!streaming && messages.length > 0 && (
            <div className="chat-tools">
              <button className="link copy-chat" onClick={() => void copyChat()} title="Copy this whole chat as text you can paste anywhere">
                {copied ? 'Copied ✓' : 'Copy chat'}
              </button>
              <button className="link copy-chat" onClick={saveChat} title="Save this chat as a file (Markdown)">
                Save as file
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageView key={m.id} m={m} busy={streaming && i === messages.length - 1} h={stable} />
          ))}
          <div ref={endRef} />
        </div>
      </div>
      <div className="session-composer">{composer}</div>
    </div>
  )
}
