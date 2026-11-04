import { hintFor, explainPrompt, fixPrompt } from '../lib/errors'
import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'

type Props = {
  spaceName: string | null
  /** Bumps after files are saved, so a failed run can be repeated automatically. */
  version: number
  onClose: () => void
  /** Hands a failed run to the chat so Setu can fix it. */
  onFix: (command: string, output: string, code: number | null) => void
  /** Asks Setu to explain the failure in simple words, without changing any file. */
  onExplain: (command: string, output: string, code: number | null) => void
}

type Result = { code: number | null; stopped: boolean; timedOut: boolean }

// Runs a command you choose in your project folder and shows the result. If it fails, one click asks Setu to fix it.
export default function RunPanel({ spaceName, version, onClose, onFix, onExplain }: Props) {
  const [trusted, setTrusted] = useState<boolean | null>(null)
  const [suggestions, setSuggestions] = useState<{ label: string; command: string }[]>([])
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [auto, setAuto] = useState(true)
  const [copied, setCopied] = useState(false)
  const outRef = useRef<HTMLPreElement>(null)
  const lastCommand = useRef('')
  const failed = useRef(false)

  useEffect(() => {
    if (!spaceName) return
    void window.setu.run.state().then((s) => {
      setTrusted(s.trusted)
      setSuggestions(s.suggestions)
      setCommand((c) => c || s.suggestions[0]?.command || '')
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [spaceName])

  useEffect(
    () =>
      window.setu.run.onEvent((e) => {
        if (e.type === 'out') setOutput((o) => (o + e.text).slice(-60_000))
        else {
          setRunning(false)
          setResult({ code: e.code, stopped: e.stopped, timedOut: e.timedOut })
          failed.current = !e.stopped && e.code !== 0
          // The live wallpaper (if chosen) answers with a green or red ripple.
          if (!e.stopped) window.dispatchEvent(new CustomEvent('setu:pulse', { detail: e.code === 0 ? 'ok' : 'bad' }))
        }
      }),
    []
  )

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight })
  }, [output])

  async function run(cmd = command) {
    setError('')
    setOutput('')
    setResult(null)
    setRunning(true)
    lastCommand.current = cmd
    try {
      await window.setu.run.start(cmd)
    } catch (e) {
      setRunning(false)
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }

  // After the user saves a fix, run the same command again so they can see whether it worked.
  const firstVersion = useRef(version)
  useEffect(() => {
    if (version === firstVersion.current) return
    firstVersion.current = version
    if (auto && failed.current && lastCommand.current && !running) void run(lastCommand.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  if (!spaceName) {
    return (
      <aside className="preview-panel run-panel">
        <div className="preview-bar">
          <strong>Run</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close run panel"><CloseIcon /></button>
        </div>
        <p className="dim run-pad">Choose a project folder first, then you can run it here.</p>
      </aside>
    )
  }

  return (
    <aside className="preview-panel run-panel" aria-label="Run">
      <div className="preview-bar">
        <strong>Run</strong>
        <span className="dim">{spaceName}</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={onClose} aria-label="Close run panel"><CloseIcon /></button>
      </div>

      {trusted === false ? (
        <div className="run-pad">
          <p>
            <strong>Do you trust this folder?</strong>
          </p>
          <p className="dim">
            Running code can do anything on your computer. Only run projects you made or got from someone you trust. Setu
            never runs anything by itself: it runs only the command you choose, and only after you press Run.
          </p>
          <AnimatedButton onClick={() => void window.setu.run.trust().then(() => setTrusted(true))}>Yes, I trust this folder</AnimatedButton>
        </div>
      ) : (
        <div className="run-pad">
          {suggestions.length > 0 && (
            <div className="run-suggest" role="group" aria-label="Suggested commands">
              {suggestions.map((s) => (
                <button key={s.command} className="chip" onClick={() => setCommand(s.command)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="add-row">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Command, for example npm test or python main.py"
              spellCheck={false}
              aria-label="Command to run"
              onKeyDown={(e) => e.key === 'Enter' && command.trim() && !running && void run()}
            />
            {running ? (
              <button className="btn" onClick={() => void window.setu.run.stop()}>Stop</button>
            ) : (
              <AnimatedButton size="sm" disabled={!command.trim()} onClick={() => void run()}>Run</AnimatedButton>
            )}
          </div>
          {suggestions.length === 0 && (
            <p className="dim">
              No test or start command found. For a plain web page, use Preview instead. Otherwise type a command above.
            </p>
          )}
          {error && <p className="msg-error">{error}</p>}
          <pre className="run-output" ref={outRef} aria-live="polite">{output || (running ? 'Running…' : 'The result shows here.')}</pre>
          {result && !running && (
            <div className={result.code === 0 ? 'run-result ok' : 'run-result bad'}>
              {result.stopped ? (
                <span>Stopped.</span>
              ) : result.timedOut ? (
                <span>Stopped after 5 minutes.</span>
              ) : result.code === 0 ? (
                <span>It worked ✓</span>
              ) : (
                <>
                  <span>It failed (code {result.code ?? '?'}).</span>
                  {hintFor(output) && <span className="run-hint">{hintFor(output)}</span>}
                  <AnimatedButton size="sm" onClick={() => onExplain(lastCommand.current, output, result.code)}>Explain simply</AnimatedButton>
                  <AnimatedButton size="sm" onClick={() => onFix(lastCommand.current, output, result.code)}>Fix this with Setu</AnimatedButton>
                  <AnimatedButton
                    size="sm"
                    onClick={() => {
                      const text = fixPrompt(lastCommand.current, output, result.code)
                      void navigator.clipboard.writeText(text).then(() => {
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 2000)
                      }).catch(() => undefined)
                    }}
                  >
                    {copied ? 'Copied ✓' : 'Copy as prompt'}
                  </AnimatedButton>
                </>
              )}
            </div>
          )}
          <label className="check-row">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span>After I save a fix, run it again automatically</span>
          </label>
        </div>
      )}
    </aside>
  )
}
