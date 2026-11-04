import AnimatedButton from '@/components/ui/animated-button'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  spaceName: string | null
  /** Bumps when files change elsewhere (a saved chat change or an undo). */
  version: number
  onSaved: () => void
  /** Ask Setu in the chat (used by "Explain this code"). */
  onAsk?: (text: string) => void
}

// A plain file viewer and editor. Saving makes an undo point first, just like a change from the chat.
export default function EditorPane({ spaceName, version, onSaved, onAsk }: Props) {
  const [files, setFiles] = useState<string[]>([])
  const [truncated, setTruncated] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [original, setOriginal] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ path: string; line: number; text: string }[] | null>(null)
  const [sel, setSel] = useState<[number, number]>([0, 0])
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const pendingLine = useRef<number | null>(null)
  const dirty = open !== null && text !== original

  const load = useCallback(async () => {
    if (!spaceName) return
    const r = await window.setu.project.list().catch(() => ({ files: [] as string[], truncated: false }))
    setFiles(r.files)
    setTruncated(r.truncated)
  }, [spaceName])

  const openFile = useCallback(async (rel: string) => {
    setNote('')
    const r = await window.setu.project.read(rel)
    if (!r.exists) return setNote('That file is gone.')
    if (r.binary) {
      setOpen(rel)
      setText('')
      setOriginal('')
      return setNote("This file can't be shown as text (it's a picture, a program, or too big).")
    }
    setOpen(rel)
    setText(r.content)
    setOriginal(r.content)
  }, [])

  useEffect(() => {
    void load()
  }, [load, version])

  // If the open file changed on disk (a saved chat change or undo) and there are no unsaved edits, show the new version.
  useEffect(() => {
    if (open && !dirty) void openFile(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  useEffect(() => {
    setOpen(null)
    setText('')
    setOriginal('')
  }, [spaceName])

  // After a search result opens a file, put the cursor on that line.
  useEffect(() => {
    const line = pendingLine.current
    const el = areaRef.current
    if (line === null || !el || !open) return
    pendingLine.current = null
    const lines = text.split('\n')
    const start = lines.slice(0, Math.max(0, line - 1)).join('\n').length + (line > 1 ? 1 : 0)
    el.focus()
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
    el.scrollTop = Math.max(0, (line - 4) * 18)
  }, [text, open])

  async function runSearch() {
    const q = query.trim()
    if (!q) return setHits(null)
    const r = await window.setu.project.search(q).catch(() => ({ hits: [], truncated: false }))
    setHits(r.hits)
  }

  async function openHit(path: string, line: number) {
    if (dirty && path !== open && !window.confirm('You have unsaved changes in this file. Switch anyway?')) return
    if (path === open) {
      pendingLine.current = line
      setText((t) => t + '')
      return
    }
    pendingLine.current = line
    await openFile(path)
  }

  function explain() {
    if (!open || !onAsk) return
    const picked = sel[1] > sel[0] ? text.slice(sel[0], sel[1]) : ''
    const code = (picked || text).slice(0, 6000)
    onAsk(
      `Explain this code in simple words, step by step${picked ? '' : ` (it is the file ${open})`}. Say what it does and point out anything risky or confusing:\n\n\`\`\`\n${code}\n\`\`\``
    )
  }

  function pick(rel: string) {
    if (dirty && !window.confirm('You have unsaved changes in this file. Switch anyway?')) return
    void openFile(rel)
  }

  async function save() {
    if (!open) return
    try {
      await window.setu.project.apply({ label: `Edited ${open}`, changes: [{ path: open, content: text }] })
      setOriginal(text)
      setNote('Saved. You can undo it under Checkpoints.')
      onSaved()
    } catch (e) {
      setNote(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }

  if (!spaceName) {
    return (
      <div className="placeholder">
        <h2>Editor</h2>
        <p>Choose a project folder in the sidebar to see and edit its files here.</p>
      </div>
    )
  }
  const shown = files.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="editor">
      <div className="editor-files">
        <div className="editor-tabs" role="group" aria-label="Files or search">
          <button className={!searchMode ? 'editor-tab active' : 'editor-tab'} onClick={() => setSearchMode(false)}>
            Files
          </button>
          <button className={searchMode ? 'editor-tab active' : 'editor-tab'} onClick={() => setSearchMode(true)}>
            Search text
          </button>
        </div>
        {searchMode ? (
          <>
            <input
              className="editor-filter"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
              placeholder="Search in all files, press Enter"
              aria-label="Search in all files"
            />
            <ul className="search-hits">
              {(hits ?? []).map((h, n) => (
                <li key={`${h.path}:${h.line}:${n}`}>
                  <button className="editor-file search-hit" onClick={() => void openHit(h.path, h.line)} title={`${h.path}:${h.line}`}>
                    <span className="hit-path">
                      {h.path}:{h.line}
                    </span>
                    <span className="hit-text">{h.text.trim().slice(0, 90)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {hits !== null && hits.length === 0 && <p className="dim">No matches.</p>}
          </>
        ) : (
          <>
        <input
          className="editor-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a file"
          aria-label="Find a file"
        />
        <ul>
          {shown.map((f) => (
            <li key={f}>
              <button className={f === open ? 'editor-file active' : 'editor-file'} onClick={() => pick(f)} title={f}>
                {f}
              </button>
            </li>
          ))}
        </ul>
        {files.length === 0 && <p className="dim">This folder has no files yet.</p>}
        {truncated && <p className="dim">Only the first files are shown.</p>}
          </>
        )}
      </div>
      <div className="editor-main">
        {open ? (
          <>
            <div className="editor-bar">
              <strong>{open}</strong>
              {dirty && <span className="dim"> · unsaved</span>}
              <span className="spacer" />
              {onAsk && (
                <AnimatedButton size="sm" onClick={explain}>
                  {sel[1] > sel[0] ? 'Explain selection' : 'Explain this file'}
                </AnimatedButton>
              )}
              <AnimatedButton size="sm" disabled={!dirty} onClick={() => void save()}>
                Save
              </AnimatedButton>
            </div>
            <textarea
              className="editor-text"
              ref={areaRef}
              onSelect={(e) => setSel([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              aria-label={`Contents of ${open}`}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                  e.preventDefault()
                  if (dirty) void save()
                }
              }}
              disabled={!!note && note.startsWith("This file can't")}
            />
          </>
        ) : (
          <div className="placeholder">
            <h2>Pick a file</h2>
            <p>Choose a file on the left to read or edit it. Changes are saved with an undo point.</p>
          </div>
        )}
        {note && <p className="dim editor-note">{note}</p>}
      </div>
    </div>
  )
}
