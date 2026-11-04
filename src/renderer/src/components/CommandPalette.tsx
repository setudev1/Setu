import { useEffect, useMemo, useRef, useState } from 'react'

export type PaletteAction = { id: string; label: string; hint?: string; run: () => void }

// Ctrl+Shift+P: type a few letters, press Enter.
export default function CommandPalette({ open, onClose, actions }: { open: boolean; onClose: () => void; actions: PaletteAction[] }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return actions.filter((a) => words.every((w) => a.label.toLowerCase().includes(w)))
  }, [q, actions])

  if (!open) return null
  const choose = (a?: PaletteAction): void => {
    if (!a) return
    onClose()
    a.run()
  }
  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="modal palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          value={q}
          placeholder="Type a command…"
          aria-label="Command"
          onChange={(e) => {
            setQ(e.target.value)
            setI(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setI((n) => (shown.length ? (n + 1) % shown.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setI((n) => (shown.length ? (n + shown.length - 1) % shown.length : 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(shown[i])
            }
          }}
        />
        <ul className="palette-list" role="listbox">
          {shown.map((a, n) => (
            <li key={a.id}>
              <button
                role="option"
                aria-selected={n === i}
                className={n === i ? 'palette-item active' : 'palette-item'}
                onMouseEnter={() => setI(n)}
                onClick={() => choose(a)}
              >
                <span>{a.label}</span>
                {a.hint && <span className="dim">{a.hint}</span>}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="dim palette-empty">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  )
}
