import { useCallback, useEffect, useState } from 'react'
import type { CheckpointInfo } from '../types'
import { CloseIcon, UndoIcon } from './icons'

type Props = { open: boolean; onClose: () => void; spaceName: string | null; onRestored: () => void }

export default function CheckpointsModal({ open, onClose, spaceName, onRestored }: Props) {
  const [items, setItems] = useState<CheckpointInfo[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await window.setu.checkpoints.list())
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    if (open) {
      setMessage('')
      void load()
    }
  }, [open, load])

  if (!open) return null

  async function restore(id: string) {
    setBusy(id)
    setMessage('')
    try {
      const r = await window.setu.checkpoints.restore(id)
      setMessage(`Restored ${r.restored.length} file${r.restored.length === 1 ? '' : 's'}. This restore can also be undone from the list.`)
      await load()
      onRestored()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Checkpoints" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Checkpoints{spaceName ? ` · ${spaceName}` : ''}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          {!spaceName && <p className="dim">Choose a project folder first.</p>}
          {spaceName && items.length === 0 && (
            <p className="dim">No checkpoints yet. One is saved automatically every time Setu changes your files.</p>
          )}
          {message && <p className="dim">{message}</p>}
          {items.map((c) => (
            <div className="model-row" key={c.id}>
              <div className="model-info">
                <div className="model-title">{c.label}</div>
                <div className="model-note">
                  {new Date(c.createdAt).toLocaleString()} · {c.files.map((f) => f.path).join(', ')}
                </div>
              </div>
              <button className="btn" disabled={busy !== null} onClick={() => void restore(c.id)}>
                <UndoIcon size={15} /> Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
