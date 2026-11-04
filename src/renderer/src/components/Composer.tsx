import { useEffect, useRef, useState } from 'react'
import type { OllamaModel } from '../types'
import { PlusIcon, SendIcon, StopIcon } from './icons'
import { isCloudModel } from '../lib/cloud'
import { allPrompts, type SavedPrompt } from '../lib/prompts'
import { fileToAttached, MAX_IMAGES, type Attached } from '../lib/images'

type Props = {
  models: OllamaModel[]
  model: string
  onModelChange: (model: string) => void
  onManageModels: () => void
  /** Return false to keep the text in the box (for example, when a warning is shown first). */
  onSend: (text: string, images: string[]) => boolean | void
  onStop: () => void
  streaming: boolean
  projectName?: string | null
  styleChips?: string[]
  placeholder?: string
  /** Project file names, for the @ picker. */
  files?: string[]
}

// Kept outside the component, because the box is rebuilt when a chat starts.
const historyStore: { current: string[] } = { current: [] }

export default function Composer({
  models,
  model,
  onModelChange,
  onManageModels,
  onSend,
  onStop,
  streaming,
  projectName,
  styleChips,
  placeholder,
  files = []
}: Props) {
  // The draft is kept on this computer, so a crash or an accidental close does not lose what you were typing.
  const [prompt, setPrompt] = useState(() => {
    try {
      return localStorage.getItem('setu.draft') ?? ''
    } catch {
      return ''
    }
  })
  const [pics, setPics] = useState<Attached[]>([])
  const [picError, setPicError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [atIndex, setAtIndex] = useState(0)
  const [prompts, setPrompts] = useState<SavedPrompt[]>(allPrompts)
  const [slashIndex, setSlashIndex] = useState(0)
  // Up arrow in an empty box brings back what you sent before, like a terminal.
  const history = historyStore
  const histPos = useRef(-1)

  useEffect(() => {
    const reload = () => setPrompts(allPrompts())
    window.addEventListener('setu:prompts', reload)
    return () => window.removeEventListener('setu:prompts', reload)
  }, [])

  // Typing "/" at the very start opens the list of ready prompts.
  const slashMatch = /^\/([a-z0-9-]*)$/.exec(prompt)
  const slashItems = slashMatch ? prompts.filter((p) => p.name.startsWith(slashMatch[1])).slice(0, 8) : []
  function chooseSlash(p: SavedPrompt) {
    setPrompt(p.text)
    setSlashIndex(0)
    taRef.current?.focus()
  }

  // Typing "@" at the start of a word opens a list of project files to point at.
  const atMatch = /(?:^|\s)@([^\s@]*)$/.exec(prompt)
  const atItems =
    atMatch && files.length > 0
      ? files.filter((f) => f.toLowerCase().includes(atMatch[1].toLowerCase())).slice(0, 6)
      : []
  function chooseFile(f: string) {
    setPrompt((p) => p.replace(/@([^\s@]*)$/, `@${f} `))
    setAtIndex(0)
    taRef.current?.focus()
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (prompt) localStorage.setItem('setu.draft', prompt.slice(0, 20000))
        else localStorage.removeItem('setu.draft')
      } catch {
        /* storage may be unavailable */
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [prompt])

  // Quick-start chips and the Ctrl+K shortcut talk to the composer through these two window events.
  useEffect(() => {
    const prefill = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (typeof text === 'string') setPrompt(text)
      taRef.current?.focus()
    }
    const focus = () => taRef.current?.focus()
    window.addEventListener('setu:prefill', prefill)
    window.addEventListener('setu:focus', focus)
    return () => {
      window.removeEventListener('setu:prefill', prefill)
      window.removeEventListener('setu:focus', focus)
    }
  }, [])

  async function addFiles(files: File[]) {
    setPicError('')
    for (const f of files) {
      if (pics.length >= MAX_IMAGES) {
        setPicError(`You can attach up to ${MAX_IMAGES} pictures.`)
        break
      }
      try {
        const a = await fileToAttached(f)
        setPics((p) => (p.length < MAX_IMAGES ? [...p, a] : p))
      } catch (e) {
        setPicError(e instanceof Error ? e.message : 'Could not add that picture.')
      }
    }
  }

  function submit() {
    const text = prompt.trim()
    if ((!text && pics.length === 0) || streaming) return
    // A picture on its own is a "Screenshot to fix" request.
    const finalText = text || 'Here is a screenshot of my problem. What is wrong, and how do I fix it?'
    if (onSend(finalText, pics.map((p) => p.dataUrl)) !== false) {
      history.current = [finalText, ...history.current.filter((h) => h !== finalText)].slice(0, 30)
      histPos.current = -1
      try {
        localStorage.removeItem('setu.draft')
      } catch {
        /* ignore */
      }
      setPrompt('')
      setPics([])
    }
  }

  return (
    <div
      className="composer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
        if (files.length) {
          e.preventDefault()
          void addFiles(files)
        }
      }}
    >
      {pics.length > 0 && (
        <div className="attach-row">
          {pics.map((p, i) => (
            <div className="attach-thumb" key={i}>
              <img src={p.dataUrl} alt={`Attached screenshot ${i + 1}`} />
              <button aria-label="Remove picture" onClick={() => setPics((all) => all.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <span className="attach-note">Screenshots can show keys or private data. Check before sending.</span>
        </div>
      )}
      {picError && <div className="attach-error">{picError}</div>}
      {atItems.length > 0 && (
        <ul className="at-menu" role="listbox" aria-label="Project files">
          {atItems.map((f, i) => (
            <li key={f}>
              <button
                role="option"
                aria-selected={i === atIndex}
                className={i === atIndex ? 'at-item active' : 'at-item'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  chooseFile(f)
                }}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      )}
      {slashItems.length > 0 && (
        <ul className="at-menu slash-menu" role="listbox" aria-label="Ready prompts">
          {slashItems.map((p, i) => (
            <li key={p.name}>
              <button
                role="option"
                aria-selected={i === slashIndex}
                className={i === slashIndex ? 'at-item active' : 'at-item'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  chooseSlash(p)
                }}
              >
                <span className="slash-name">/{p.name}</span>
                <span className="slash-text">{p.text.slice(0, 60)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={taRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
          if (files.length) {
            e.preventDefault()
            void addFiles(files)
          }
        }}
        onKeyDown={(e) => {
          if (slashItems.length > 0) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setSlashIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : slashItems.length - 1)) % slashItems.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              chooseSlash(slashItems[Math.min(slashIndex, slashItems.length - 1)])
              return
            }
            if (e.key === 'Escape') {
              setPrompt('')
              return
            }
          }
          if (atItems.length > 0) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setAtIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : atItems.length - 1)) % atItems.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              chooseFile(atItems[Math.min(atIndex, atItems.length - 1)])
              return
            }
            if (e.key === 'Escape') {
              setPrompt((p) => p.replace(/@([^\s@]*)$/, '$1'))
              return
            }
          }
          if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && history.current.length > 0 && !e.shiftKey) {
            const atStart = e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0
            const atEnd = e.currentTarget.selectionStart === prompt.length
            if (e.key === 'ArrowUp' && (prompt === '' || (histPos.current >= 0 && atStart))) {
              e.preventDefault()
              histPos.current = Math.min(histPos.current + 1, history.current.length - 1)
              setPrompt(history.current[histPos.current])
              return
            }
            if (e.key === 'ArrowDown' && histPos.current >= 0 && atEnd) {
              e.preventDefault()
              histPos.current -= 1
              setPrompt(histPos.current < 0 ? '' : history.current[histPos.current])
              return
            }
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder ?? 'Describe a task. Enter to send, Shift+Enter for a new line. Type / for ready prompts.'}
        rows={3}
      />
      <div className="composer-row">
        <div className="composer-left">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <button
            className="chip"
            onClick={() => fileRef.current?.click()}
            disabled={streaming}
            title="Attach a screenshot of an error. You can also paste or drop a picture."
            aria-label="Attach a screenshot"
          >
            <PlusIcon size={16} />
          </button>
          <span className="chip static">Code</span>
          <select
            className="chip select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={models.length === 0 || streaming}
            aria-label="Model"
          >
            {models.length === 0 ? (
              <option value="">No model yet</option>
            ) : (
              models.map((m) => (
                <option key={m.name} value={m.name}>
                  {isCloudModel(m.name) ? `${m.name} (cloud)` : m.name}
                </option>
              ))
            )}
          </select>
          <button className="chip" onClick={onManageModels}>
            Manage models
          </button>
        </div>
        <div className="composer-right">
          <span
            className={projectName ? 'chip static' : 'chip static muted'}
            title={projectName ? 'Setu can see and change files in this folder' : 'No project folder chosen: chat only'}
          >
            {projectName ? projectName : 'No folder'}
          </span>
          {styleChips?.map((c) => (
            <span className="chip static" key={c} title="Change this in Settings">
              {c}
            </span>
          ))}
          {isCloudModel(model) ? (
            <span
              className="chip static pill on"
              title="This model runs on Ollama's servers. Your messages, and project files if a folder is chosen, are sent there."
            >
              Cloud
            </span>
          ) : (
            <span className="chip static muted" title="Everything stays on this computer">
              Local only
            </span>
          )}
          {streaming ? (
            <button className="send" onClick={onStop} aria-label="Stop">
              <StopIcon size={16} />
            </button>
          ) : (
            <button className="send" onClick={submit} disabled={!prompt.trim() && pics.length === 0} aria-label="Send">
              <SendIcon size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
