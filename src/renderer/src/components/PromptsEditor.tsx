import AnimatedButton from '@/components/ui/animated-button'
import { useState } from 'react'
import { cleanPromptName, loadCustomPrompts, saveCustomPrompts, type SavedPrompt } from '../lib/prompts'

// Settings section: save your own /commands.
export default function PromptsEditor() {
  const [list, setList] = useState<SavedPrompt[]>(loadCustomPrompts)
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const ok = cleanPromptName(name).length > 0 && text.trim().length > 0

  function update(next: SavedPrompt[]) {
    setList(next)
    saveCustomPrompts(next)
  }
  function add() {
    if (!ok) return
    const n = cleanPromptName(name)
    update([{ name: n, text: text.trim() }, ...list.filter((p) => p.name !== n)].slice(0, 50))
    setName('')
    setText('')
  }
  return (
    <>
      <h3>My / commands</h3>
      <p className="dim">
        Type <code>/</code> in the message box to pick a ready prompt, like <code>/fix</code> or <code>/review</code>. Save your own here.
      </p>
      <div className="prompt-add">
        <input
          className="select-field"
          value={name}
          maxLength={20}
          placeholder="name, like landing"
          aria-label="Command name"
          onChange={(e) => setName(cleanPromptName(e.target.value))}
        />
        <textarea
          className="select-field"
          value={text}
          maxLength={2000}
          rows={3}
          placeholder="What Setu should do, in your own words"
          aria-label="Command text"
          onChange={(e) => setText(e.target.value)}
        />
        <AnimatedButton size="sm" disabled={!ok} onClick={add}>
          Save command
        </AnimatedButton>
      </div>
      <ul className="prompt-list">
        {list.map((p) => (
          <li key={p.name}>
            <span className="prompt-name">/{p.name}</span>
            <span className="dim prompt-text">{p.text.slice(0, 70)}</span>
            <button className="icon-btn small" aria-label={`Delete /${p.name}`} onClick={() => update(list.filter((x) => x.name !== p.name))}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
