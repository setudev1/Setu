// "Run" for the project folder: runs a command the USER chose, in the folder they picked, and streams the output back.
// Setu never runs a command on its own, and only in folders the user has marked as trusted.
import { spawn, execFile, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { StringDecoder } from 'string_decoder'

const MAX_OUTPUT = 200_000
const TIMEOUT_MS = 5 * 60_000

export type RunSuggestion = { label: string; command: string }

export async function detectCommands(root: string): Promise<RunSuggestion[]> {
  const out: RunSuggestion[] = []
  const exists = (f: string): Promise<boolean> => fs.stat(join(root, f)).then(() => true, () => false)
  try {
    const pkg = JSON.parse(await fs.readFile(join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
    const s = pkg.scripts ?? {}
    for (const name of ['test', 'start', 'dev', 'build']) {
      if (s[name] && !(name === 'test' && /no test specified/i.test(s[name]))) {
        out.push({ label: `npm ${name}`, command: name === 'test' || name === 'start' ? `npm ${name}` : `npm run ${name}` })
      }
    }
  } catch {
    /* no package.json */
  }
  for (const f of ['main.py', 'app.py', 'index.py']) if (await exists(f)) out.push({ label: `python ${f}`, command: `python ${f}` })
  if (await exists('pytest.ini') || (await exists('tests'))) out.push({ label: 'pytest', command: 'python -m pytest' })
  for (const f of ['index.js', 'server.js', 'app.js']) {
    if (await exists(f) && !out.some((o) => o.command === `node ${f}`)) out.push({ label: `node ${f}`, command: `node ${f}` })
  }
  return out.slice(0, 6)
}

export function cleanCommand(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Type a command to run.')
  const c = value.trim()
  if (!c) throw new Error('Type a command to run.')
  if (c.length > 300 || /[\r\n]/.test(c)) throw new Error('Use one short command on a single line.')
  return c
}

let current: { child: ChildProcess; stopped: boolean } | null = null

export const isRunning = (): boolean => current !== null

export function stopRun(): void {
  if (!current) return
  current.stopped = true
  killTree(current.child)
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => undefined)
  else {
    // The command runs in its own process group so that its children (npm -> node) stop too.
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  }
}

export function startRun(
  root: string,
  command: string,
  onData: (text: string) => void,
  onExit: (info: { code: number | null; stopped: boolean; timedOut: boolean }) => void
): void {
  if (current) throw new Error('Something is already running. Stop it first.')
  const child = spawn(command, { cwd: root, shell: true, windowsHide: true, detached: process.platform !== 'win32', env: { ...process.env, FORCE_COLOR: '0', CI: '1' } })
  const state = { child, stopped: false }
  current = state
  let size = 0
  // One decoder per stream, so a character split across two chunks is not turned into garbage.
  const dec = { out: new StringDecoder('utf8'), err: new StringDecoder('utf8') }
  const push = (b: Buffer, d: StringDecoder): void => {
    if (size >= MAX_OUTPUT) return
    let t = d.write(b)
    if (!t) return
    size += t.length
    if (size >= MAX_OUTPUT) t = t.slice(0, Math.max(0, t.length - (size - MAX_OUTPUT))) + '\n[output cut off]\n'
    onData(t)
  }
  child.stdout?.on('data', (b: Buffer) => push(b, dec.out))
  child.stderr?.on('data', (b: Buffer) => push(b, dec.err))
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    killTree(child)
  }, TIMEOUT_MS)
  const finish = (code: number | null): void => {
    clearTimeout(timer)
    if (current === state) current = null
    onExit({ code, stopped: state.stopped, timedOut })
  }
  child.on('error', (e) => {
    onData(`Could not start the command: ${e.message}\n`)
    finish(1)
  })
  child.on('close', (code) => finish(code))
}

// Folders the user has said they trust. Kept in a small file next to the other Setu settings.
export async function isTrusted(file: string, root: string): Promise<boolean> {
  try {
    const list = JSON.parse(await fs.readFile(file, 'utf8')) as string[]
    return Array.isArray(list) && list.includes(root.toLowerCase())
  } catch {
    return false
  }
}

export async function trustFolder(file: string, root: string): Promise<void> {
  let list: string[] = []
  try {
    const v = JSON.parse(await fs.readFile(file, 'utf8'))
    if (Array.isArray(v)) list = v.filter((x) => typeof x === 'string')
  } catch {
    /* first time */
  }
  if (!list.includes(root.toLowerCase())) list.push(root.toLowerCase())
  await fs.writeFile(file, JSON.stringify(list, null, 2))
}
