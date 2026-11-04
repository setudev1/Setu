import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useMemo, useState } from 'react'
import type { FileRead, Proposal } from '../types'
import { parseFileBlocks } from '../lib/fileBlocks'
import { collapse, diffLines, diffStats } from '../lib/diff'
import { CheckIcon, UndoIcon } from './icons'

type Loaded = { read: FileRead | null; error?: string }

type Props = {
  text: string
  proposal: Proposal
  hasSpace: boolean
  onApply: (changes: { path: string; content: string }[]) => void
  onReject: () => void
  onUndo: () => void
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const items = useMemo(() => collapse(diffLines(oldText, newText)), [oldText, newText])
  return (
    <pre className="diff">
      {items.map((it, i) =>
        it.type === 'gap' ? (
          <div key={i} className="diff-gap">
            … {it.count} unchanged line{it.count === 1 ? '' : 's'} …
          </div>
        ) : (
          <div key={i} className={`diff-line ${it.type}`}>
            <span className="diff-sign">{it.type === 'add' ? '+' : it.type === 'del' ? '−' : ' '}</span>
            {it.text || ' '}
          </div>
        )
      )}
    </pre>
  )
}

export default function ChangeCard({ text, proposal, hasSpace, onApply, onReject, onUndo }: Props) {
  const blocks = useMemo(() => parseFileBlocks(text), [text])
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({})
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // Read each file's current content so the diff can be shown before anything is saved.
  useEffect(() => {
    if (!hasSpace) return
    let cancelled = false
    for (const b of blocks) {
      window.setu.project
        .read(b.path)
        .then((read) => !cancelled && setLoaded((p) => ({ ...p, [b.path]: { read } })))
        .catch((e) => !cancelled && setLoaded((p) => ({ ...p, [b.path]: { read: null, error: e instanceof Error ? e.message : String(e) } })))
    }
    return () => {
      cancelled = true
    }
  }, [blocks, hasSpace])

  if (blocks.length === 0) return null

  const rows = blocks.map((b) => {
    const l = loaded[b.path]
    const ready = !!l
    const blocked =
      !hasSpace ||
      !b.complete ||
      !!l?.error ||
      (l?.read?.exists === true && l.read.binary === true)
    const old = l?.read && l.read.exists && !l.read.binary ? l.read.content : ''
    const isNew = !!l?.read && l.read.exists === false
    return { b, ready, blocked, old, isNew, error: l?.error }
  })
  const selectable = rows.filter((r) => r.ready && !r.blocked)
  const isPicked = (path: string): boolean => picked[path] !== false
  const chosen = selectable.filter((r) => isPicked(r.b.path))

  if (proposal.status === 'rejected') {
    return <div className="change-card done muted">Changes dismissed. Nothing was saved.</div>
  }

  if (proposal.status === 'applied' || proposal.status === 'undone') {
    const undone = proposal.status === 'undone'
    return (
      <div className={`change-card done ${undone ? 'muted' : 'ok'}`}>
        <div className="change-done-row">
          <span>
            {undone ? (
              <>Undone. Your files are back as they were.</>
            ) : (
              <>
                <CheckIcon size={15} /> Saved {proposal.written?.length ?? 0} file
                {(proposal.written?.length ?? 0) === 1 ? '' : 's'}: {proposal.written?.join(', ')}
              </>
            )}
          </span>
          {!undone && (
            <button className="btn" onClick={() => void window.setu.spaces.reveal().catch(() => undefined)}>
              Open folder
            </button>
          )}
          {!undone && (
            <button className="btn" onClick={onUndo}>
              <UndoIcon size={15} /> Undo
            </button>
          )}
        </div>
        {proposal.error && <p className="msg-error">{proposal.error}</p>}
      </div>
    )
  }

  return (
    <div className="change-card">
      <div className="change-head">
        Proposed changes · {blocks.length} file{blocks.length === 1 ? '' : 's'}
      </div>
      {!hasSpace && (
        <p className="change-warn">Choose a project folder in the sidebar to save these changes.</p>
      )}
      {rows.map((r) => {
        const stats = diffStats(diffLines(r.old, r.b.content))
        return (
          <div className="change-file" key={r.b.path}>
            <div className="change-row">
              <input
                type="checkbox"
                checked={!r.blocked && isPicked(r.b.path)}
                disabled={r.blocked || !r.ready}
                onChange={(e) => setPicked((p) => ({ ...p, [r.b.path]: e.target.checked }))}
                aria-label={`Include ${r.b.path}`}
              />
              <button
                className="change-path"
                onClick={() => setOpen((o) => ({ ...o, [r.b.path]: !(o[r.b.path] ?? blocks.length <= 3) }))}
              >
                {r.b.path}
              </button>
              {r.ready && !r.error && (
                <span className={r.isNew ? 'tag new' : 'tag mod'}>{r.isNew ? 'new' : 'changed'}</span>
              )}
              {r.ready && !r.error && (
                <span className="change-stats">
                  <span className="plus">+{stats.added}</span> <span className="minus">−{stats.removed}</span>
                </span>
              )}
            </div>
            {!r.b.complete && (
              <p className="change-warn">This file was cut off before it finished, so it can't be saved.</p>
            )}
            {r.error && <p className="change-warn">{r.error}</p>}
            {r.ready && !r.error && r.blocked && r.b.complete && hasSpace && (
              <p className="change-warn">This is a binary or very large file, so it can't be changed.</p>
            )}
            {(open[r.b.path] ?? blocks.length <= 3) && r.ready && !r.error && <DiffView oldText={r.old} newText={r.b.content} />}
          </div>
        )
      })}
      <div className="change-actions">
        <AnimatedButton
          size="sm"
          disabled={chosen.length === 0}
          onClick={() => onApply(chosen.map((r) => ({ path: r.b.path, content: r.b.content })))}
        >
          Save {chosen.length} file{chosen.length === 1 ? '' : 's'}
        </AnimatedButton>
        <button className="btn" onClick={onReject}>
          Dismiss
        </button>
        <span className="change-hint">Green lines are added, red lines are removed. Click a file name to show or hide them. An undo point is saved first.</span>
      </div>
      {proposal.error && <p className="msg-error">{proposal.error}</p>}
    </div>
  )
}
