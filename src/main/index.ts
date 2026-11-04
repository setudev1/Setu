import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { promises as fsp } from 'fs'
import { pathToFileURL } from 'url'
import {
  friendlyError,
  getStatus,
  isValidModelName,
  listModels,
  pullModel,
  SCREENSHOT_PROMPT,
  streamChat,
  warmModel,
  SYSTEM_PROMPT,
  supportsVision,
  type ChatMessage
} from './ollama'
import { addSpace, getState, removeSpace, selectSpace } from './spaces'
import { buildContext, listFiles, NO_FOLDER_PROMPT, PROJECT_PROMPT, readRules, readText, searchProject, trimNotes } from './project'
import { gitState } from './git'
import { checkForUpdate } from './updates'
import { fetchReviews, writeUrl } from './reviews'
import { appendLog, lastLines, reportUrl } from './report'
import { homedir } from 'os'
import { contextNotice, estimateTokens, fitHistory, historyBudget, localWindow } from './context'
import { checkTarget, reportText, QA_WIDTH, QA_HEIGHT } from './qa'
import { runQaWindow } from './qaWindow'
import { findOllama, installOllama, startOllama, type SetupEvent } from './ollamaSetup'
import { cleanCommand, detectCommands, isRunning, isTrusted, startRun, stopRun, trustFolder } from './runner'
import { applyChanges, listCheckpoints, restoreCheckpoint, type Change } from './checkpoints'
import { clearWallpaper, getWallpaper, getWallpaperFile, setLook, setWallpaper } from './wallpaper'
import { buildStyle, parseStyle } from './style'
import { getSystemInfo } from './system'
import { clearImageKey, imageReady, makeImage, setImageKey } from './images'
import { clearKey, hasKey, listOrModels, setKey, streamOpenRouter } from './openrouter'
import { listProviders, PRESETS, removeProvider, saveProvider, streamProvider } from './providers'

// Lets the interface show the wallpaper (including video) without giving it access to the file system.
protocol.registerSchemesAsPrivileged([
  { scheme: 'setu-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

const chats = new Map<string, AbortController>()
const pulls = new Map<string, AbortController>()

const spacesFile = (): string => join(app.getPath('userData'), 'spaces.json')
const wallpaperDir = (): string => join(app.getPath('userData'), 'wallpaper')

// The renderer never sends a folder path for file work: the main process uses the folder the user picked.
async function activeRoot(): Promise<string> {
  const state = await getState(spacesFile())
  if (!state.active) throw new Error('Choose a project folder first.')
  return state.active
}

function notesPath(root: string): string {
  const key = createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 16)
  return join(app.getPath('userData'), 'notes', `${key}.md`)
}
async function readNotes(root: string): Promise<string> {
  try {
    return trimNotes(await fsp.readFile(notesPath(root), 'utf8'))
  } catch {
    return ''
  }
}

function checkpointDir(root: string): string {
  const key = createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 16)
  return join(app.getPath('userData'), 'checkpoints', key)
}

function parseChatRequest(req: unknown): {
  id: string
  model: string
  messages: ChatMessage[]
  useProject: boolean
  style: ReturnType<typeof parseStyle>
  focus: string[]
} {
  const r = req as { id?: unknown; model?: unknown; messages?: unknown; useProject?: unknown; style?: unknown; focus?: unknown }
  if (typeof r?.id !== 'string' || r.id.length === 0 || r.id.length > 64) throw new Error('Bad request.')
  if (!isValidModelName(r.model)) throw new Error('Invalid model name.')
  if (!Array.isArray(r.messages) || r.messages.length === 0 || r.messages.length > 400) {
    throw new Error('Bad messages.')
  }
  let totalImages = 0
  const messages = r.messages.map((m: { role?: unknown; content?: unknown; images?: unknown }) => {
    if (
      (m?.role !== 'user' && m?.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length > 200_000
    ) {
      throw new Error('Bad message.')
    }
    const out: ChatMessage = { role: m.role, content: m.content }
    if (m.images !== undefined) {
      if (!Array.isArray(m.images) || m.images.length > 3) throw new Error('Bad pictures.')
      const imgs = m.images.map((i: unknown) => {
        if (typeof i !== 'string' || i.length > 14_000_000 || !/^[A-Za-z0-9+/=]+$/.test(i)) throw new Error('Bad picture.')
        return i
      })
      totalImages += imgs.length
      if (totalImages > 4) throw new Error('Too many pictures in one chat.')
      if (imgs.length > 0) out.images = imgs
    }
    return out
  })
  const focus = Array.isArray(r.focus)
    ? r.focus.filter((f: unknown): f is string => typeof f === 'string' && f.length > 0 && f.length <= 200).slice(0, 3)
    : []
  return { id: r.id, model: r.model, messages, useProject: r.useProject === true, style: parseStyle(r.style), focus }
}

function parseChanges(value: unknown): Change[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new Error('Bad changes.')
  return value.map((c: { path?: unknown; content?: unknown }) => {
    if (typeof c?.path !== 'string' || typeof c.content !== 'string') throw new Error('Bad changes.')
    return { path: c.path, content: c.content }
  })
}

// Asks a model one question (with one screenshot) and returns its whole reply. Used by "Test like a person".
async function askModelOnce(model: string, prompt: string, shot: string, signal: AbortSignal): Promise<string> {
  const messages: ChatMessage[] = [{ role: 'user', content: prompt, images: [shot] }]
  const system = `${SYSTEM_PROMPT}\n\nYou are a careful software tester. Reply with the one JSON object asked for and nothing else.`
  let out = ''
  const onToken = (t: string): void => {
    out += t
  }
  const apiMatch = /^api:([a-z0-9-]{1,40}):(.+)$/.exec(model)
  if (apiMatch) await streamProvider({ providerId: apiMatch[1], model: apiMatch[2], messages, system, signal, onToken, onDone: () => undefined })
  else if (model.startsWith('or:')) await streamOpenRouter({ model: model.slice(3), messages, system, signal, onToken, onDone: () => undefined })
  else await streamChat({ model, messages, system, signal, onToken, onDone: () => undefined })
  return out
}

const qaRuns = new Map<string, AbortController>()
const apiOrCloud = (model: string): boolean => model.startsWith('api:') || model.startsWith('or:') || /[:-]cloud$/i.test(model)

function registerIpc(): void {
  ipcMain.handle('ollama:status', async () => {
    let st = await getStatus()
    if (!st.running) {
      await ensureOllama()
      st = await getStatus()
    }
    return st
  })
  ipcMain.handle('ollama:list', () => listModels())
  ipcMain.handle('ollama:vision', (_e, model: unknown) => (isValidModelName(model) ? supportsVision(model) : false))
  ipcMain.handle('system:info', () => getSystemInfo())

  // ---- Ollama setup: install it for the user (Windows) and start it ----
  let setupAbort: AbortController | null = null
  ipcMain.handle('ollama:installed', () => findOllama() !== null)
  ipcMain.handle('ollama:start', () => startOllama())
  ipcMain.handle('ollama:setup', (event) => {
    if (setupAbort) return false
    const ctl = new AbortController()
    setupAbort = ctl
    const emit = (e: SetupEvent): void => {
      if (!event.sender.isDestroyed()) event.sender.send('ollama:setup-event', e)
    }
    void installOllama(emit, ctl.signal).finally(() => {
      setupAbort = null
    })
    return true
  })
  ipcMain.handle('ollama:setup-cancel', () => {
    setupAbort?.abort()
    return true
  })

  // ---- Run: the user picks a command, Setu runs it in the (trusted) project folder and shows the output ----
  const trustFile = (): string => join(app.getPath('userData'), 'trusted-folders.json')
  ipcMain.handle('run:state', async () => {
    const root = await activeRoot()
    return { trusted: await isTrusted(trustFile(), root), suggestions: await detectCommands(root), running: isRunning() }
  })
  ipcMain.handle('run:trust', async () => {
    await trustFolder(trustFile(), await activeRoot())
    return true
  })
  ipcMain.handle('run:start', async (event, command: unknown) => {
    const root = await activeRoot()
    if (!(await isTrusted(trustFile(), root))) throw new Error('Trust this folder before running code in it.')
    const cmd = cleanCommand(command)
    const send = (payload: object): void => {
      if (!event.sender.isDestroyed()) event.sender.send('run:event', payload)
    }
    startRun(root, cmd, (text) => send({ type: 'out', text }), (info) => send({ type: 'exit', ...info }))
    return true
  })
  ipcMain.handle('run:stop', () => {
    stopRun()
    return true
  })
  ipcMain.handle('project:search', async (_e, q: unknown) => searchProject(await activeRoot(), typeof q === 'string' ? q.slice(0, 200) : ''))
  ipcMain.handle('image:status', () => imageReady())
  ipcMain.handle('image:setkey', (_e, account: unknown, token: unknown) => {
    setImageKey(account, token)
    return true
  })
  ipcMain.handle('image:clear', () => {
    clearImageKey()
    return false
  })
  ipcMain.handle('image:make', async (_e, prompt: unknown) => {
    const root = await activeRoot().catch(() => null)
    return makeImage(root, prompt)
  })
  ipcMain.handle('notes:get', async () => readNotes(await activeRoot()))
  ipcMain.handle('notes:set', async (_e, text: unknown) => {
    const root = await activeRoot()
    const t = trimNotes(typeof text === 'string' ? text : '')
    await fsp.mkdir(dirname(notesPath(root)), { recursive: true })
    await fsp.writeFile(notesPath(root), t, 'utf8')
    return t
  })
  ipcMain.handle('git:state', async () => gitState(await activeRoot()))
  ipcMain.handle('update:check', () => checkForUpdate(app.getVersion()))
  ipcMain.handle('update:open', (_e, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url)
    return true
  })
  // "Report a problem": opens a prefilled public GitHub issue. Nothing is sent until the person presses Submit there.
  ipcMain.handle('report:log', (_e, message: unknown) => {
    if (typeof message === 'string') appendLog(logFile(), `screen: ${message.slice(0, 600)}`)
    return true
  })
  ipcMain.handle('report:open', (_e, note: unknown) => {
    const info = { version: app.getVersion(), platform: process.platform, arch: process.arch, electron: process.versions.electron ?? '', lines: lastLines(logFile(), 5) }
    void shell.openExternal(reportUrl(info, typeof note === 'string' ? note : '', homedir()))
    return true
  })
  ipcMain.handle('reviews:list', () => fetchReviews())
  ipcMain.handle('reviews:write', (_e, stars: unknown, text: unknown) => {
    void shell.openExternal(writeUrl(stars, text))
    return true
  })
  ipcMain.handle('project:list', async () => listFiles(await activeRoot()))

  // OpenRouter (cloud models with your own key). The key stays in this process; the interface only learns "saved or not".
  // Your own API keys for other companies (OpenAI, Claude, Gemini, ...). Keys never reach the interface.
  ipcMain.handle('providers:list', () => ({ presets: PRESETS, providers: listProviders() }))
  ipcMain.handle('providers:save', (_e, req: unknown) => {
    try {
      saveProvider(req)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('providers:remove', (_e, id: unknown) => {
    removeProvider(id)
    return { ok: true }
  })
  ipcMain.handle('or:status', () => ({ hasKey: hasKey() }))
  ipcMain.handle('or:setKey', (_e, key: unknown) => {
    try {
      setKey(key)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('or:clearKey', () => {
    clearKey()
    return { ok: true }
  })
  ipcMain.handle('or:models', async () => {
    try {
      return { ok: true, models: await listOrModels() }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('chat:start', async (event, req: unknown) => {
    const { id, model, messages, useProject, style, focus } = parseChatRequest(req)
    const controller = new AbortController()
    chats.set(id, controller)
    const send = (payload: object): void => {
      if (!event.sender.isDestroyed()) event.sender.send('chat:event', { id, ...payload })
    }

    let system: string | undefined
    if (useProject) {
      try {
        const root = await activeRoot()
        const rules = await readRules(root)
        const notes = await readNotes(root)
        system = `${PROJECT_PROMPT}${rules ? `\n\nThe user's own rules for this project (from SETU.md). Follow them:\n${rules}` : ''}${notes ? `\n\nNotes the user asked Setu to remember for this project (decisions, plans, things to keep in mind). Use them, and do not repeat them back unless asked:\n${notes}` : ''}\n\n${await buildContext(root, 8000, focus)}`
      } catch (err) {
        chats.delete(id)
        send({ type: 'error', message: friendlyError(err) })
        return true
      }
    }
    if (!useProject) system = NO_FOLDER_PROMPT
    if (messages.some((m) => m.images?.length)) system = system ? `${system}\n\n${SCREENSHOT_PROMPT}` : SCREENSHOT_PROMPT
    const styleText = buildStyle(style)
    if (styleText) system = system ? `${system}\n\n${styleText}` : styleText

    // Keep the chat inside the model's memory: drop the oldest messages instead of letting the model lose the project files.
    const systemTokens = estimateTokens(`${SYSTEM_PROMPT}\n\n${system ?? ''}`)
    const win = localWindow()
    const { budget, limit } = historyBudget(model, systemTokens, win)
    const fit = fitHistory(messages, budget, systemTokens, limit)
    const notice = contextNotice(fit, !apiOrCloud(model))
    if (notice) send({ type: 'context', notice })

    // Models named "or:vendor/model" go to OpenRouter; everything else goes to Ollama on this computer.
    const apiMatch = /^api:([a-z0-9-]{1,40}):(.+)$/.exec(model)
    const run = apiMatch
      ? streamProvider({
          providerId: apiMatch[1],
          model: apiMatch[2],
          messages: fit.messages,
          system: system ? `${SYSTEM_PROMPT}\n\n${system}` : SYSTEM_PROMPT,
          signal: controller.signal,
          onToken: (text) => send({ type: 'token', text }),
          onDone: (info) => send({ type: 'done', ...info })
        })
      : model.startsWith('or:')
      ? streamOpenRouter({
          model: model.slice(3),
          messages: fit.messages,
          system: system ? `${SYSTEM_PROMPT}\n\n${system}` : SYSTEM_PROMPT,
          signal: controller.signal,
          onToken: (text) => send({ type: 'token', text }),
          onDone: (info) => send({ type: 'done', ...info })
        })
      : streamChat({
          model,
          messages: fit.messages,
          system,
          numCtx: win,
          signal: controller.signal,
          onToken: (text) => send({ type: 'token', text }),
          onDone: (info) => send({ type: 'done', ...info })
        })
    run
      .catch((err) => {
        if (controller.signal.aborted) send({ type: 'done', stopped: true })
        else send({ type: 'error', message: friendlyError(err) })
      })
      .finally(() => chats.delete(id))
    return true
  })

  ipcMain.handle('qa:start', async (event, req: unknown) => {
    const r = (req && typeof req === 'object' ? req : {}) as Record<string, unknown>
    const id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(r.id) ? r.id : null
    const model = typeof r.model === 'string' && r.model.length > 0 && r.model.length < 200 ? r.model : null
    const goal = typeof r.goal === 'string' ? r.goal.replace(/\s+/g, ' ').trim().slice(0, 400) : ''
    if (!id || !model) throw new Error('Pick a model first.')
    if (!goal) throw new Error('Say what the test should check, such as "add a todo and see it in the list".')
    if (!model.startsWith('api:') && !model.startsWith('or:') && !(await supportsVision(model))) {
      throw new Error('This model cannot read pictures. Pick a model that can see images, or one of your cloud models.')
    }
    const root = await activeRoot().catch(() => null)
    const target = checkTarget(r.target, root)
    if ('error' in target) throw new Error(target.error)
    const controller = new AbortController()
    qaRuns.set(id, controller)
    const send = (payload: object): void => {
      if (!event.sender.isDestroyed()) event.sender.send('qa:event', { id, ...payload })
    }
    runQaWindow({
      url: target.url,
      goal,
      signal: controller.signal,
      ask: (prompt, shot) => askModelOnce(model, prompt, shot, controller.signal),
      onStep: (s) => send({ type: 'step', n: s.n, thought: s.thought, action: s.action, shot: s.shot })
    })
      .then((report) => send({ type: 'done', report, text: reportText(goal, report, typeof r.target === 'string' ? r.target.trim() : target.url), size: [QA_WIDTH, QA_HEIGHT] }))
      .catch((err) => send({ type: 'error', message: friendlyError(err) }))
      .finally(() => qaRuns.delete(id))
    return true
  })

  ipcMain.handle('qa:stop', (_event, id: unknown) => {
    if (typeof id === 'string') qaRuns.get(id)?.abort()
    return true
  })

  // Takes a picture of one part of the Setu window (the preview), for "Share my build".
  ipcMain.handle('share:capture', async (event, rect: unknown) => {
    const r = (rect && typeof rect === 'object' ? rect : {}) as Record<string, unknown>
    const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN)
    const x = n(r.x), y = n(r.y), width = n(r.width), height = n(r.height)
    if ([x, y, width, height].some(Number.isNaN) || width < 20 || height < 20 || width > 4000 || height > 4000 || x < 0 || y < 0) return null
    try {
      const img = await event.sender.capturePage({ x, y, width, height })
      const out = img.getSize().width > 1400 ? img.resize({ width: 1400 }) : img
      return out.toDataURL()
    } catch {
      return null
    }
  })
  ipcMain.handle('ollama:warm', async (_event, model: unknown) => {
    if (typeof model !== 'string' || !model || model.length > 200 || model.startsWith('api:') || model.startsWith('or:') || /[:-]cloud$/i.test(model)) return false
    await warmModel(model, localWindow())
    return true
  })
  ipcMain.handle('chat:stop', (_event, id: unknown) => {
    if (typeof id === 'string') chats.get(id)?.abort()
    return true
  })

  ipcMain.handle('pull:start', (event, name: unknown) => {
    if (!isValidModelName(name)) throw new Error('Invalid model name.')
    if (pulls.has(name)) return true
    const controller = new AbortController()
    pulls.set(name, controller)
    const send = (payload: object): void => {
      if (!event.sender.isDestroyed()) event.sender.send('pull:event', { name, ...payload })
    }
    pullModel({
      name,
      signal: controller.signal,
      onProgress: (p) => send({ type: 'progress', ...p })
    })
      .then(() => send({ type: 'done' }))
      .catch((err) => {
        send({
          type: 'error',
          message: controller.signal.aborted ? 'Cancelled.' : friendlyError(err)
        })
      })
      .finally(() => pulls.delete(name))
    return true
  })

  ipcMain.handle('pull:cancel', (_event, name: unknown) => {
    if (typeof name === 'string') pulls.get(name)?.abort()
    return true
  })

  // ---- project folders ----
  // No folder chosen yet? Setu makes one itself (Documents/Setu Projects/My first project) so files can always be saved.
  ipcMain.handle('spaces:state', async () => {
    const state = await getState(spacesFile())
    if (state.spaces.length > 0 || state.active) return state
    try {
      const dir = join(app.getPath('documents'), 'Setu Projects', 'My first project')
      await fsp.mkdir(dir, { recursive: true })
      return await addSpace(spacesFile(), dir)
    } catch {
      return state
    }
  })

  ipcMain.handle('spaces:reveal', async () => {
    const root = await activeRoot()
    const err = await shell.openPath(root)
    if (err) throw new Error(err)
    return true
  })

  ipcMain.handle('spaces:add', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choose a project folder', properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return getState(spacesFile())
    return addSpace(spacesFile(), result.filePaths[0])
  })

  ipcMain.handle('spaces:select', (_event, folder: unknown) => {
    if (typeof folder !== 'string') throw new Error('Bad request.')
    return selectSpace(spacesFile(), folder)
  })

  ipcMain.handle('spaces:remove', (_event, folder: unknown) => {
    if (typeof folder !== 'string') throw new Error('Bad request.')
    return removeSpace(spacesFile(), folder)
  })

  // ---- wallpaper ----
  ipcMain.handle('wallpaper:get', () => getWallpaper(wallpaperDir()))

  ipcMain.handle('wallpaper:choose', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Choose a wallpaper',
      properties: ['openFile'] as 'openFile'[],
      filters: [
        { name: 'Images and videos', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'mp4', 'webm'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return getWallpaper(wallpaperDir())
    return setWallpaper(wallpaperDir(), result.filePaths[0])
  })

  ipcMain.handle('wallpaper:clear', () => clearWallpaper(wallpaperDir()))
  ipcMain.handle('wallpaper:look', (_event, look: unknown) => setLook(wallpaperDir(), look as { dim?: unknown; blur?: unknown }))

  // ---- files in the active project ----
  ipcMain.handle('project:read', async (_event, rel: unknown) => readText(await activeRoot(), rel as string))

  ipcMain.handle('project:apply', async (_event, req: unknown) => {
    const r = req as { label?: unknown; changes?: unknown }
    const label = typeof r?.label === 'string' ? r.label.slice(0, 200) : 'Change'
    const root = await activeRoot()
    return applyChanges(root, checkpointDir(root), label, parseChanges(r?.changes))
  })

  ipcMain.handle('checkpoints:list', async () => {
    const root = await activeRoot()
    return listCheckpoints(checkpointDir(root))
  })

  ipcMain.handle('checkpoints:restore', async (_event, id: unknown) => {
    const root = await activeRoot()
    return restoreCheckpoint(root, checkpointDir(root), id as string)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Setu',
    // The installed app gets its icon from the .exe. When running from source, point at the icon file so the taskbar shows Setu, not Electron's atom.
    icon: app.isPackaged ? undefined : join(app.getAppPath(), 'build', 'icon.png'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    // Custom title bar: our own header, with the native window buttons overlaid on the right.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#000000', symbolColor: '#e7e9ec', height: 40 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // The window starts hidden to avoid a white flash. If the "ready" signal never comes (a slow or failed load), show it anyway,
  // so the person never ends up with a Setu that is running but invisible.
  const showOnce = (): void => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }
  win.once('ready-to-show', showOnce)
  setTimeout(showOnce, 4000)
  win.webContents.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (!isMainFrame) return
    appendLog(logFile(), `screen failed to load (${code}) ${desc}`)
    showOnce()
  })

  // The app is one local page. Anything that tries to navigate away goes to the browser instead (https only).
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    if (url.startsWith('https://')) shell.openExternal(url)
  })

  // Links that try to open a new window go to the user's browser, https only.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// In development the screen is loaded from a local server and Chromium caches every file on disk. When that cache is
// locked (a leftover window, OneDrive, antivirus) it prints hundreds of "Failed to save user data" lines. Skip the
// disk cache there. The installed app loads from files and is not affected.
if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) app.commandLine.appendSwitch('disable-http-cache')

// One Setu at a time: a second launch just brings the first window forward.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

// A surprise error in the background should not close Setu or show a scary crash box.
// If Ollama is installed but not running, start it quietly, once per run of Setu. If that did not work, the person
// can press Start. Trying again and again would only cause trouble (extra windows, many copies).
let ollamaStarting: Promise<boolean> | null = null
async function ensureOllama(): Promise<boolean> {
  if (!findOllama()) return false
  if (!ollamaStarting) ollamaStarting = startOllama()
  return ollamaStarting
}

const logFile = (): string => join(app.getPath('userData'), 'setu.log')
const logErr = (err: unknown): void => {
  console.error('Setu error:', err)
  appendLog(logFile(), err instanceof Error ? `${err.message} ${(err.stack ?? '').split('\n').slice(1, 3).join(' ')}` : String(err))
}
process.on('uncaughtException', logErr)
process.on('unhandledRejection', logErr)

if (gotLock) app.whenReady().then(() => {
  // Lets Windows group the taskbar button and show Setu's icon and name.
  if (process.platform === 'win32') app.setAppUserModelId('com.setudev.setu')
  void ensureOllama() // start the AI engine in the background if it is installed
  // Serves only the one wallpaper file the user chose, whatever address is asked for.
  protocol.handle('setu-media', async (request) => {
    if (new URL(request.url).hostname !== 'wallpaper') return new Response('Not found', { status: 404 })
    const file = await getWallpaperFile(wallpaperDir())
    if (!file) return new Response('Not found', { status: 404 })
    const res = await net.fetch(pathToFileURL(file).toString(), {
      headers: request.headers,
      bypassCustomProtocolHandlers: true
    })
    // Lets the window measure how bright the wallpaper is, so text can be kept readable on it.
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  })
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
