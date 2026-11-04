import AnimatedButton from '@/components/ui/animated-button'
import { useMemo, useState } from 'react'
import type { Proposal } from '../types'
import { parseLooseBlocks, validFileName } from '../lib/fileBlocks'
import ChangeCard from './ChangeCard'
import './loose.css'

type Props = {
  text: string
  proposal: Proposal
  hasSpace: boolean
  onApply: (changes: { path: string; content: string }[]) => void
  onReject: () => void
  onUndo: () => void
}

// The model wrote code but did not say which file it belongs to. The user picks the file name(s),
// then the normal "Proposed changes" card (diff + Save + Undo) takes over. Nothing is saved without Save.
export default function LooseCodeSaver({ text, proposal, hasSpace, onApply, onReject, onUndo }: Props) {
  const blocks = useMemo(() => parseLooseBlocks(text), [text])
  const [names, setNames] = useState<string[]>(() => blocks.map((b) => b.suggested))
  const [confirmed, setConfirmed] = useState(false)
  if (blocks.length === 0) return null
  if (!hasSpace) {
    return (
      <p className="msg-note format-note">
        This answer has code. Choose a project folder in the sidebar and Setu can save it as a file for you.
      </p>
    )
  }
  const allValid = names.every((n) => validFileName(n))
  if (confirmed || proposal.status !== 'pending') {
    const synthetic = blocks
      .map((b, i) => 'FILE: ' + names[i].trim().replace(/\\/g, '/') + '\n```\n' + b.content + '\n```')
      .join('\n\n')
    return (
      <>
        {proposal.status === 'pending' && (
          <button className="link" onClick={() => setConfirmed(false)}>
            Change file names
          </button>
        )}
        <ChangeCard text={synthetic} proposal={proposal} hasSpace={hasSpace} onApply={onApply} onReject={onReject} onUndo={onUndo} />
      </>
    )
  }
  return (
    <div className="change-card loose-card">
      <div className="change-head">This code has no file name yet</div>
      <p className="loose-help">Pick a file name for each part. If the file already exists, Setu will show what changes in it.</p>
      {blocks.map((b, i) => (
        <div className="loose-row" key={i}>
          <span className="tag mod">{b.lang || 'code'}</span>
          <input
            className="loose-input"
            value={names[i]}
            aria-label={'File name for code part ' + (i + 1)}
            onChange={(e) => setNames((n) => n.map((x, k) => (k === i ? e.target.value : x)))}
          />
          <span className="change-stats">{b.content.split('\n').length} lines</span>
        </div>
      ))}
      {!allValid && <p className="change-warn">Use a simple file name with an ending, like index.html or src/app.js.</p>}
      <div className="change-actions">
        <AnimatedButton size="sm" disabled={!allValid} onClick={() => setConfirmed(true)}>
          Review changes
        </AnimatedButton>
        <button className="btn" onClick={onReject}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
