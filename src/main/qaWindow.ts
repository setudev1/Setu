// The sandboxed test window for "Test like a person". It has no access to Setu or to this computer:
// no Node, no preload, its own empty session, no downloads, no permissions, and no extra windows.
import { BrowserWindow, session } from 'electron'
import { QA_HEIGHT, QA_WIDTH, runQa, type QaAction, type QaReport, type QaStep } from './qa'

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Electron names the arrow keys without the word "Arrow".
const KEY_NAMES: Record<string, string> = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }

export async function runQaWindow(opts: {
  url: string
  goal: string
  signal: AbortSignal
  ask: (prompt: string, shot: string) => Promise<string>
  onStep: (s: QaStep & { shot: string }) => void
}): Promise<QaReport> {
  const ses = session.fromPartition(`setu-qa-${Date.now()}`) // no "persist:" prefix, so nothing is kept
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  ses.on('will-download', (e) => e.preventDefault())

  const win = new BrowserWindow({
    width: QA_WIDTH,
    height: QA_HEIGHT,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Setu test window',
    backgroundColor: '#ffffff',
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  const wc = win.webContents
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  let closed = false
  win.on('closed', () => (closed = true))

  let problems: string[] = []
  const note = (t: string): void => {
    const s = t.replace(/\s+/g, ' ').trim().slice(0, 200)
    if (s && problems.length < 20) problems.push(s)
  }
  wc.on('console-message', (_e, level, message) => {
    if (level === 3) note(message)
  })
  wc.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) note(`The page failed to load (${desc}).`)
  })
  wc.on('render-process-gone', () => note('The page crashed.'))

  const alive = (): void => {
    if (closed || win.isDestroyed()) throw new Error('The test window was closed.')
  }

  try {
    await win.loadURL(opts.url)
    await pause(800)
    return await runQa({
      goal: opts.goal,
      signal: opts.signal,
      ask: opts.ask,
      onStep: opts.onStep,
      problems: () => {
        const p = problems
        problems = []
        return p
      },
      shot: async () => {
        alive()
        const img = await wc.capturePage()
        const small = img.getSize().width > QA_WIDTH ? img.resize({ width: QA_WIDTH }) : img
        return small.toJPEG(60).toString('base64')
      },
      perform: async (a: QaAction) => {
        alive()
        if (a.kind === 'click') {
          wc.sendInputEvent({ type: 'mouseMove', x: a.x, y: a.y })
          wc.sendInputEvent({ type: 'mouseDown', x: a.x, y: a.y, button: 'left', clickCount: 1 })
          wc.sendInputEvent({ type: 'mouseUp', x: a.x, y: a.y, button: 'left', clickCount: 1 })
        } else if (a.kind === 'type') {
          await wc.insertText(a.text)
        } else if (a.kind === 'key') {
          const keyCode = KEY_NAMES[a.key] ?? a.key
          wc.sendInputEvent({ type: 'keyDown', keyCode })
          if (a.key === 'Enter') wc.sendInputEvent({ type: 'char', keyCode: '\r' })
          wc.sendInputEvent({ type: 'keyUp', keyCode })
        } else if (a.kind === 'scroll') {
          await wc.executeJavaScript(`window.scrollBy(0, ${Math.round(a.dy)})`, true)
        }
        await pause(a.kind === 'wait' ? 1200 : 600)
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { verdict: 'unclear', summary: /closed/.test(msg) ? msg : `The test could not run: ${msg}`, bugs: [], steps: 0, problems }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}
