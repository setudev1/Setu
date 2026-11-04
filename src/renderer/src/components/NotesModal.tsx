import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useState } from 'react'
import { CloseIcon } from './icons'

type Props = { open: boolean; onClose: () => void; spaceName: string | null; add: string; onSaved: (msg: string) => void }

// Project memory: short notes Setu reads in every chat for this project.
export default function NotesModal({ open, onClose, spaceName, add, onSaved }: Props) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!open) return
    setErr('')
    window.setu.notes
      .get()
      .then((t) => setText(add ? `${t ? `${t}\n` : ''}- ${add.trim().replace(/\s+/g, ' ').slice(0, 300)}` : t))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not read the notes.'))
  }, [open, add])
  if (!open) return null
  async function save() {
    try {
      await window.setu.notes.set(text)
      onSaved('Saved. Setu will remember these notes in every chat for this project.')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.')
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal notes-modal" role="dialog" aria-label="Project notes" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Notes{spaceName ? ` for ${spaceName}` : ''}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="dim">Write what Setu should remember about this project: decisions, plans, things to avoid. Setu reads this in every chat.</p>
        <textarea
          className="select-field notes-text"
          value={text}
          rows={10}
          maxLength={6000}
          aria-label="Project notes"
          placeholder={'- We use plain CSS, no frameworks\n- Login page is done, next is the dashboard'}
          onChange={(e) => setText(e.target.value)}
        />
        {err && <p className="msg-error">{err}</p>}
        <div className="modal-actions">
          <span className="dim">{text.length} / 4000 (the newest part is kept)</span>
          <AnimatedButton size="sm" onClick={() => void save()}>
            Save notes
          </AnimatedButton>
        </div>
      </div>
    </div>
  )
}
