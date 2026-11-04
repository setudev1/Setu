// Gets Ollama onto this computer without shipping it inside the Setu installer (it is about 1 GB).
// Setu downloads the official installer from ollama.com the first time it is needed, installs it quietly for the
// current user (no admin prompt), and starts it. Nothing here runs unless the user clicks "Set up Ollama for me".
import { spawn, execFile } from 'child_process'

// Flash attention makes answers faster and uses less memory on most computers.
const FAST_ENV = { ...process.env, OLLAMA_FLASH_ATTENTION: '1' }
import { createWriteStream, existsSync, promises as fs } from 'fs'
import { homedir, tmpdir } from 'os'
import { dirname, join } from 'path'
import { getStatus } from './ollama'

const INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe'
const MIN_BYTES = 50 * 1024 * 1024 // a real installer is hundreds of MB; anything tiny is an error page

export type SetupEvent =
  | { type: 'progress'; stage: 'download' | 'install' | 'start'; percent?: number; message: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export function findOllama(): string | null {
  if (process.platform !== 'win32') return null
  const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  const candidates = [
    join(local, 'Programs', 'Ollama', 'ollama.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Ollama', 'ollama.exe')
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

/** The Ollama tray app (no console window), next to ollama.exe. It starts the background server by itself. */
export function findOllamaApp(): string | null {
  const exe = findOllama()
  if (!exe) return null
  const app = join(dirname(exe), 'ollama app.exe')
  return existsSync(app) ? app : null
}

/** Starts the Ollama background server if it is installed but not running. Never opens a visible window. */
export async function startOllama(): Promise<boolean> {
  if ((await getStatus()).running) return true
  const exe = findOllama()
  if (!exe) return false
  // Prefer the tray app: it has no console, so Windows Terminal cannot pop up a tab. Fall back to "ollama serve".
  const tray = findOllamaApp()
  const child = tray
    ? spawn(tray, [], { detached: true, stdio: 'ignore', windowsHide: true, env: FAST_ENV })
    : spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true, env: FAST_ENV })
  child.on('error', () => undefined)
  child.unref()
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if ((await getStatus()).running) return true
  }
  return false
}


// Decides whether the downloaded installer may run, from what Windows says about its digital signature.
// A bad or foreign signature stops the install. An unsigned file or a failed check does not, so a good download is never blocked by mistake.
export function signatureVerdict(status: string, subject: string): { ok: boolean; reason?: string } {
  const st = status.trim()
  if (st === 'Valid') {
    return /ollama/i.test(subject) ? { ok: true } : { ok: false, reason: 'The installer is signed by someone other than Ollama.' }
  }
  if (st === '' || st === 'NotSigned' || st === 'UnknownError') return { ok: true }
  return { ok: false, reason: `Windows says the installer's signature is not valid (${st}).` }
}

function readSignature(file: string): Promise<{ status: string; subject: string }> {
  return new Promise((resolve) => {
    const script = `$s = Get-AuthenticodeSignature -LiteralPath $env:SETU_FILE; Write-Output $s.Status; Write-Output ($s.SignerCertificate.Subject)`
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 20_000, windowsHide: true, env: { ...process.env, SETU_FILE: file } }, (err, stdout) => {
      if (err) return resolve({ status: 'UnknownError', subject: '' })
      const [status = '', subject = ''] = String(stdout).split(/\r?\n/)
      resolve({ status, subject })
    })
  })
}

export async function installOllama(emit: (e: SetupEvent) => void, signal: AbortSignal): Promise<void> {
  if (process.platform !== 'win32') {
    emit({ type: 'error', message: 'Automatic setup is only available on Windows. Install Ollama from ollama.com/download, then reopen Setu.' })
    return
  }
  const file = join(tmpdir(), `OllamaSetup-${Date.now()}.exe`)
  try {
    if (!findOllama()) {
      emit({ type: 'progress', stage: 'download', percent: 0, message: 'Downloading Ollama…' })
      const res = await fetch(INSTALLER_URL, { signal, redirect: 'follow' })
      if (!res.ok || !res.body) throw new Error(`Could not download Ollama (error ${res.status}). Check your internet and try again.`)
      const total = Number(res.headers.get('content-length')) || 0
      const out = createWriteStream(file)
      let got = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reader = (res.body as any).getReader()
      let last = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        got += value.length
        if (!out.write(value)) await new Promise((r) => out.once('drain', r))
        const pct = total ? Math.round((got / total) * 100) : undefined
        if (pct !== undefined && pct !== last) {
          last = pct
          emit({ type: 'progress', stage: 'download', percent: pct, message: `Downloading Ollama… ${pct}%` })
        }
      }
      await new Promise<void>((r, j) => out.end((e: unknown) => (e ? j(e) : r())))
      const head = Buffer.alloc(2)
      const fh = await fs.open(file, 'r')
      await fh.read(head, 0, 2, 0)
      await fh.close()
      if (got < MIN_BYTES || head.toString('latin1') !== 'MZ') {
        throw new Error('The download was not a valid installer. Try again, or install Ollama from ollama.com/download.')
      }
      const sig = await readSignature(file)
      const verdict = signatureVerdict(sig.status, sig.subject)
      if (!verdict.ok) throw new Error(`${verdict.reason} Setu did not run it. Install Ollama from ollama.com/download instead.`)
      emit({ type: 'progress', stage: 'install', message: 'Installing Ollama (this takes a minute)…' })
      const code: number = await new Promise((resolve, reject) => {
        const p = spawn(file, ['/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES'], { windowsHide: true })
        signal.addEventListener('abort', () => p.kill())
        p.on('error', reject)
        p.on('exit', (c) => resolve(c ?? 1))
      })
      if (signal.aborted) return
      if (code !== 0 && !findOllama()) throw new Error('The Ollama installer did not finish. Install it from ollama.com/download instead.')
    }
    emit({ type: 'progress', stage: 'start', message: 'Starting Ollama…' })
    if (!(await startOllama())) throw new Error('Ollama is installed but did not start. Open Ollama from the Start menu, then press Retry.')
    emit({ type: 'done' })
  } catch (err) {
    if (signal.aborted) return
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  } finally {
    fs.unlink(file).catch(() => undefined)
  }
}
