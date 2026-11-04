// "Test like a person" (beta): a model looks at a screenshot of a page, picks one action at a time
// (click, type, key, scroll), and Setu performs it inside a sandboxed test window. This file holds
// only the logic that can be tested without Electron: parsing the model's answer, checking the
// target, and running the loop with the window and the model passed in.
import { isAbsolute, relative, resolve, sep } from 'path'
import { pathToFileURL } from 'url'

export type QaAction =
  | { kind: 'click'; x: number; y: number }
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; dy: number }
  | { kind: 'wait' }
  | { kind: 'done'; verdict: 'pass' | 'fail'; summary: string; bugs: string[] }

export type QaVerdict = 'pass' | 'fail' | 'unclear'
export type QaStep = { n: number; thought: string; action: QaAction }
export type QaReport = { verdict: QaVerdict; summary: string; bugs: string[]; steps: number; problems: string[] }

export const QA_MAX_STEPS = 20
export const QA_MAX_MS = 5 * 60 * 1000
export const QA_WIDTH = 1024
export const QA_HEIGHT = 640

const KEYS = new Set(['Enter', 'Tab', 'Escape', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'])

const clean = (t: unknown, max: number): string =>
  String(t ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Finds the first {...} object in the model's reply (it may add words or code fences) and checks it. */
export function parseAction(raw: string, width = QA_WIDTH, height = QA_HEIGHT): { thought: string; action: QaAction } | null {
  const text = String(raw ?? '')
  const start = text.indexOf('{')
  if (start < 0) return null
  let obj: Record<string, unknown> | null = null
  // Try each closing brace from the end so a trailing explanation does not break the parse.
  for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>
        break
      }
    } catch {
      /* try a shorter slice */
    }
  }
  if (!obj) return null
  const thought = clean(obj.thought, 200)
  const kind = clean(obj.action, 20).toLowerCase()
  if (kind === 'click') {
    const x = num(obj.x)
    const y = num(obj.y)
    if (x === null || y === null) return null
    return { thought, action: { kind: 'click', x: Math.min(width - 1, Math.max(0, Math.round(x))), y: Math.min(height - 1, Math.max(0, Math.round(y))) } }
  }
  if (kind === 'type') {
    const t = clean(obj.text, 200)
    return t ? { thought, action: { kind: 'type', text: t } } : null
  }
  if (kind === 'key') {
    const key = String(obj.key ?? '')
    return KEYS.has(key) ? { thought, action: { kind: 'key', key } } : null
  }
  if (kind === 'scroll') {
    const dy = num(obj.dy)
    if (dy === null) return null
    return { thought, action: { kind: 'scroll', dy: Math.max(-800, Math.min(800, Math.round(dy))) } }
  }
  if (kind === 'wait') return { thought, action: { kind: 'wait' } }
  if (kind === 'done') {
    const verdict = clean(obj.verdict, 10).toLowerCase() === 'pass' ? 'pass' : 'fail'
    const bugs = Array.isArray(obj.bugs) ? obj.bugs.map((b) => clean(b, 200)).filter(Boolean).slice(0, 5) : []
    return { thought, action: { kind: 'done', verdict, summary: clean(obj.summary, 400), bugs } }
  }
  return null
}

/** The test window may open: this project's own pages, local servers, and https sites. Nothing else. */
export function checkTarget(input: unknown, root: string | null): { url: string } | { error: string } {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw || raw.length > 500) return { error: 'Type the address of the page to test, such as http://localhost:5173' }
  if (/^https?:\/\//i.test(raw)) {
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      return { error: 'That address does not look right.' }
    }
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol === 'http:' && !local) return { error: 'Only https addresses, or localhost, can be tested.' }
    if (u.username || u.password) return { error: 'Leave the user name and password out of the address.' }
    return { url: u.toString() }
  }
  if (!root) return { error: 'Open a project first, or type a full address that starts with http.' }
  const file = isAbsolute(raw) ? raw : resolve(root, raw)
  const rel = relative(root, file)
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) return { error: 'That file is outside your project.' }
  if (!/\.html?$/i.test(file)) return { error: 'Pick an .html file from your project, or a web address.' }
  return { url: pathToFileURL(file).toString() }
}

export function stepPrompt(goal: string, history: QaStep[], step: number, maxSteps: number, newProblems: string[], width = QA_WIDTH, height = QA_HEIGHT): string {
  const past = history.slice(-6).map((s) => `${s.n}. ${describe(s.action)}${s.thought ? ` (${s.thought})` : ''}`)
  return [
    `You are testing a web page like a careful person would. The screenshot is ${width} by ${height} pixels; x goes right from 0 and y goes down from 0.`,
    `Goal of this test: ${goal}`,
    past.length ? `What you did so far:\n${past.join('\n')}` : 'You have not done anything yet.',
    newProblems.length ? `The page reported these problems just now:\n${newProblems.map((p) => `- ${p}`).join('\n')}` : '',
    `This is step ${step} of at most ${maxSteps}. Reply with ONE JSON object and nothing else. Choose one:`,
    `{"thought":"short reason","action":"click","x":100,"y":200}`,
    `{"thought":"short reason","action":"type","text":"hello"}  (types into the box you clicked)`,
    `{"thought":"short reason","action":"key","key":"Enter"}  (Enter, Tab, Escape, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, PageUp, PageDown)`,
    `{"thought":"short reason","action":"scroll","dy":400}  (positive scrolls down)`,
    `{"thought":"waiting for the page","action":"wait"}`,
    `{"thought":"why","action":"done","verdict":"pass","summary":"what worked","bugs":[]}  (use verdict "fail" and list what is wrong in bugs, at most 5, when something is broken or the goal cannot be reached)`,
    `Rules: only act on what you can see. Never type real passwords or personal details; use made-up test values. If you cannot make progress, finish with verdict "fail" and say why.`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function describe(a: QaAction): string {
  switch (a.kind) {
    case 'click':
      return `click at ${a.x},${a.y}`
    case 'type':
      return `type "${a.text}"`
    case 'key':
      return `press ${a.key}`
    case 'scroll':
      return `scroll ${a.dy > 0 ? 'down' : 'up'} ${Math.abs(a.dy)}`
    case 'wait':
      return 'wait'
    case 'done':
      return `finish: ${a.verdict}`
  }
}

export type QaDriver = {
  goal: string
  maxSteps?: number
  maxMs?: number
  signal?: AbortSignal
  /** Screenshot of the test window as base64 JPEG. */
  shot: () => Promise<string>
  /** Sends the screenshot and prompt to the model and returns its whole reply. */
  ask: (prompt: string, shot: string) => Promise<string>
  perform: (a: QaAction) => Promise<void>
  /** New console errors or load failures since the last call. */
  problems: () => string[]
  onStep?: (s: QaStep & { shot: string }) => void
  now?: () => number
}

export async function runQa(d: QaDriver): Promise<QaReport> {
  const maxSteps = d.maxSteps ?? QA_MAX_STEPS
  const maxMs = d.maxMs ?? QA_MAX_MS
  const now = d.now ?? Date.now
  const t0 = now()
  const history: QaStep[] = []
  const allProblems: string[] = []
  let invalid = 0
  let pending: string[] = []
  let n = 0

  const finish = (verdict: QaVerdict, summary: string, bugs: string[] = []): QaReport => ({
    verdict,
    summary,
    bugs,
    steps: history.length,
    problems: allProblems.slice(0, 10)
  })

  while (n < maxSteps) {
    if (d.signal?.aborted) return finish('unclear', 'You stopped the test.')
    if (now() - t0 > maxMs) return finish('unclear', 'The test ran out of time before it finished.')
    n++
    const shot = await d.shot()
    const fresh = d.problems()
    for (const p of fresh) if (!allProblems.includes(p)) allProblems.push(p)
    pending = fresh
    const reply = await d.ask(stepPrompt(d.goal, history, n, maxSteps, pending), shot)
    if (d.signal?.aborted) return finish('unclear', 'You stopped the test.')
    const parsed = parseAction(reply)
    if (!parsed) {
      invalid++
      if (invalid >= 3) return finish('unclear', 'The model did not give clear steps. Try a stronger model that can read images.')
      n--
      continue
    }
    invalid = 0
    const step: QaStep = { n, thought: parsed.thought, action: parsed.action }
    d.onStep?.({ ...step, shot })
    if (parsed.action.kind === 'done') {
      history.push(step)
      const extra = allProblems.length ? ` The page also reported ${allProblems.length} problem${allProblems.length > 1 ? 's' : ''} in its console.` : ''
      return finish(parsed.action.verdict, parsed.action.summary + (parsed.action.verdict === 'pass' ? extra : ''), parsed.action.bugs)
    }
    const last3 = history.slice(-2).map((s) => JSON.stringify(s.action))
    history.push(step)
    if (last3.length === 2 && last3.every((a) => a === JSON.stringify(parsed.action))) {
      return finish('unclear', 'The test got stuck repeating the same step.')
    }
    await d.perform(parsed.action)
  }
  return finish('unclear', `The test stopped after ${maxSteps} steps without a clear answer.`)
}

/** A short write-up the user can paste into chat, so Setu can fix what was found. */
export function reportText(goal: string, r: QaReport, target: string): string {
  const head = r.verdict === 'pass' ? 'The test passed.' : r.verdict === 'fail' ? 'The test found a problem.' : 'The test could not finish.'
  const lines = [`I asked Setu to test ${target} like a person. Goal: ${goal}`, '', `${head} ${r.summary}`.trim()]
  if (r.bugs.length) lines.push('', 'What looks wrong:', ...r.bugs.map((b) => `- ${b}`))
  if (r.problems.length) lines.push('', 'Errors the page printed:', ...r.problems.map((p) => `- ${p}`))
  if (r.verdict !== 'pass') lines.push('', 'Please find the cause in my code and fix it.')
  return lines.join('\n')
}
