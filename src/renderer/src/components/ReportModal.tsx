import AnimatedButton from '@/components/ui/animated-button'
import { useState } from 'react'
import { CloseIcon } from './icons'

type Props = { open: boolean; onClose: () => void }

export default function ReportModal({ open, onClose }: Props) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Report a problem" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Report a problem</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="dim">
            Say what happened and what you expected. Setu opens a public GitHub page with your note, the Setu version and
            your system name, and the last few error lines with your folder names removed. You read it and press Submit
            yourself. Nothing is sent before that. You need a free GitHub account.
          </p>
          <textarea
            className="rv-text"
            value={text}
            maxLength={1500}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: I clicked Preview and the page stayed blank."
            aria-label="What happened"
          />
          <div className="add-row">
            <AnimatedButton
              size="sm"
              onClick={() => {
                void window.setu.report.open(text)
                setDone(true)
              }}
            >
              Open GitHub
            </AnimatedButton>
            {done && <span className="dim" role="status">Opened in your browser.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
