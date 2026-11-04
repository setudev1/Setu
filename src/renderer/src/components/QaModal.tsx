import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'

type Action = { kind: string; x?: number; y?: number; text?: string; key?: string; dy?: number; verdict?: string }
type Step = { n: number; thought: string; action: Action; shot: string }
type Report = { verdict: 'pass' | 'fail' | 'unclear'; summary: string; bugs: string[]; steps: number; problems: string[] }
type Props = { open: boolean; onClose: () => void; model: string; hasProject: boolean; onSendToChat: (text: string) => void }

const say = (a: Action): string =>
  a.kind === 'click' ? `Click at ${a.x}, ${a.y}` : a.kind === 'type' ? `Type "${a.text}"` : a.kind === 'key' ? `Press ${a.key}` : a.kind === 'scroll' ? `Scroll ${(a.dy ?? 0) > 0 ? 'down' : 'up'}` : a.kind === 'wait' ? 'Wait' : `Finish (${a.verdict})`

// Test like a person (beta). A model looks at a test window and clicks and types in it, like a tester would.
// It only controls that one window, never this computer.
export default function QaModal({ open, onClose, model, hasProject, onSendToChat }: Props) {
  const [target, setTarget] = useState(() => localStorage.getItem('setu.qaTarget') ?? 'http://localhost:5173')
  const [goal, setGoal] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [report, setReport] = useState<{ report: Report; text: string } | null>(null)
  const [err, setErr] = useState('')
  const idRef = useRef('')
  const [shown, setShown] = useState<Step | null>(null)

  useEffect(() => {
    const off = window.setu.qa.onEvent((p) => {
      const e = p as { id?: string; type?: string; n?: number; thought?: string; action?: Action; shot?: string; report?: Report; text?: string; message?: string }
      if (e.id !== idRef.current) return
      if (e.type === 'step' && e.action && typeof e.shot === 'string') {
        const s: Step = { n: e.n ?? 0, thought: e.thought ?? '', action: e.action, shot: e.shot }
        setSteps((old) => [...old, s])
        setShown(s)
      } else if (e.type === 'done' && e.report) {
        setReport({ report: e.report, text: e.text ?? '' })
        setRunning(false)
      } else if (e.type === 'error') {
        setErr(e.message ?? 'The test stopped.')
        setRunning(false)
      }
    })
    return off
  }, [])

  if (!open) return null
  const fail = (e: unknown): void => setErr(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Something went wrong.')
  async function start() {
    setErr('')
    setReport(null)
    setSteps([])
    setShown(null)
    idRef.current = crypto.randomUUID()
    try {
      localStorage.setItem('setu.qaTarget', target)
    } catch {
      /* not saved */
    }
    setRunning(true)
    try {
      await window.setu.qa.start({ id: idRef.current, model, target, goal })
    } catch (e) {
      fail(e)
      setRunning(false)
    }
  }
  const stop = (): void => void window.setu.qa.stop(idRef.current)
  const verdictText = report?.report.verdict === 'pass' ? 'Passed' : report?.report.verdict === 'fail' ? 'Found a problem' : 'Could not finish'

  return (
    <div className="modal-backdrop" onMouseDown={running ? undefined : onClose}>
      <div className="modal qa-modal" role="dialog" aria-label="Test like a person" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Test like a person <span className="beta-tag">beta</span></h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={running}>
            <CloseIcon />
          </button>
        </div>
        <p className="dim">
          Setu opens your page in a small test window and tries it like a person: it looks at the screen, clicks and types. It only controls that window, never your computer, and it never leaves the page you give it.
          Works best with a model that can see images.
        </p>
        <label className="qa-label" htmlFor="qa-target">Page to test</label>
        <input id="qa-target" className="select-field" value={target} maxLength={500} disabled={running} onChange={(e) => setTarget(e.target.value)} placeholder="http://localhost:5173 or dist/index.html" />
        <p className="dim qa-hint">Start your app first (use the Run panel), then type its address. {hasProject ? 'You can also type an .html file from your project.' : 'Open a project to test an .html file.'}</p>
        <label className="qa-label" htmlFor="qa-goal">What should it check?</label>
        <textarea id="qa-goal" className="select-field" rows={3} maxLength={400} disabled={running} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Add a todo called milk, mark it done, and check it shows as finished" />
        <p className="dim qa-hint">Model: {model || 'none picked yet'}. Up to 20 steps or 5 minutes, then it stops.</p>
        <div className="modal-actions">
          {running ? (
            <AnimatedButton size="sm" onClick={stop}>Stop test</AnimatedButton>
          ) : (
            <AnimatedButton size="sm" disabled={!goal.trim() || !target.trim() || !model} onClick={() => void start()}>Start test</AnimatedButton>
          )}
        </div>
        {err && <p className="msg-error">{err}</p>}
        {shown && (
          <div className="qa-view">
            <img src={`data:image/jpeg;base64,${shown.shot}`} alt={`What Setu saw at step ${shown.n}`} />
            <p className="dim">Step {shown.n}: {say(shown.action)}{shown.thought ? ` — ${shown.thought}` : ''}</p>
          </div>
        )}
        {steps.length > 0 && (
          <ol className="qa-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <button className={`link${shown?.n === s.n ? ' on' : ''}`} onClick={() => setShown(s)}>{say(s.action)}</button>
              </li>
            ))}
          </ol>
        )}
        {report && (
          <div className={`qa-report ${report.report.verdict}`}>
            <h3>{verdictText}</h3>
            <p>{report.report.summary}</p>
            {report.report.bugs.length > 0 && <ul>{report.report.bugs.map((b) => <li key={b}>{b}</li>)}</ul>}
            {report.report.problems.length > 0 && (
              <>
                <p className="dim">Errors the page printed:</p>
                <ul>{report.report.problems.map((b) => <li key={b}>{b}</li>)}</ul>
              </>
            )}
            <div className="modal-actions">
              <AnimatedButton size="sm" onClick={() => { onSendToChat(report.text); onClose() }}>
                {report.report.verdict === 'pass' ? 'Put the report in chat' : 'Ask Setu to fix it'}
              </AnimatedButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
