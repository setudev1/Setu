import AnimatedButton from '@/components/ui/animated-button'
import { useState } from 'react'
import { addLearned, loadLearned, saveLearned } from '../lib/learned'

// Settings section: what Setu has learned about how you like answers.
export default function LearnedEditor() {
  const [list, setList] = useState<string[]>(loadLearned)
  const [text, setText] = useState('')
  return (
    <>
      <h3>What Setu learned about you</h3>
      <p className="dim">
        Use the thumbs under an answer to teach Setu. These short notes stay on this computer and are added to every chat, so answers fit you better. The model itself is not changed.
      </p>
      <div className="prompt-add">
        <input
          className="select-field"
          value={text}
          maxLength={160}
          placeholder="For example: keep answers short, use plain CSS"
          aria-label="Teach Setu something"
          onChange={(e) => setText(e.target.value)}
        />
        <AnimatedButton
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            setList(addLearned(text))
            setText('')
          }}
        >
          Teach Setu
        </AnimatedButton>
      </div>
      <ul className="prompt-list learned-list">
        {list.length === 0 && <li className="dim">Nothing yet.</li>}
        {list.map((r) => (
          <li key={r}>
            <span className="prompt-text">{r}</span>
            <button className="icon-btn small" aria-label={`Forget: ${r}`} onClick={() => setList(saveLearned(list.filter((x) => x !== r)))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {list.length > 0 && (
        <button className="link" onClick={() => setList(saveLearned([]))}>
          Forget everything
        </button>
      )}
    </>
  )
}
