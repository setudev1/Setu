import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TitleBar from './components/TitleBar'
import PreviewPanel from './components/PreviewPanel'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import Session from './components/Session'
import Composer from './components/Composer'
import StatusBanner from './components/StatusBanner'
import ModelManager from './components/ModelManager'
import CheckpointsModal from './components/CheckpointsModal'
import Wallpaper from './components/Wallpaper'
import SettingsModal from './components/SettingsModal'
import FirstRun from './components/FirstRun'
import { deleteSession, loadSessions, saveSession } from './lib/sessions'
import type { SavedSession } from './lib/sessions'
import { findSecrets, secretKinds } from './lib/secrets'
import Welcome from './components/Welcome'
import RunPanel from './components/RunPanel'
import EditorPane from './components/EditorPane'
import HelpModal from './components/HelpModal'
import NotesModal from './components/NotesModal'
import ImageModal from './components/ImageModal'
import QaModal from './components/QaModal'
import ReviewsModal from './components/ReviewsModal'
import ReportModal from './components/ReportModal'
import { explainPrompt, fixPrompt } from './lib/errors'
import { loadLearned } from './lib/learned'
import { LOOP_MAX_RUNS, everyLabel, parseLoop } from './lib/loop'
import ProvidersModal from './components/ProvidersModal'
import CommandPalette, { type PaletteAction } from './components/CommandPalette'
import { addUsage, formatTokens, loadCap, totalTokens, loadUsage } from './lib/usage'
import { greetingName } from './lib/callme'
import { isScene } from './lib/scenes'
import { hasCloudConsent, apiModelName, isCloudModel, isOpenRouter, isRemoteModel, loadApiModels, loadOrModels, saveApiModels, saveCloudConsent, saveOrModels, type SavedApiModel, type SavedOrModel } from './lib/cloud'
import { ACCENTS, THEMES } from './types'
import type { Mode, OllamaModel, Prefs, SpacesState, UiMessage, WallpaperState } from './types'

type Status = 'checking' | 'running' | 'down'

function updateLast(prev: UiMessage[], change: (m: UiMessage) => UiMessage): UiMessage[] {
  if (prev.length === 0) return prev
  const copy = prev.slice()
  copy[copy.length - 1] = change(copy[copy.length - 1])
  return copy
}

function updateById(prev: UiMessage[], id: string, change: (m: UiMessage) => UiMessage): UiMessage[] {
  return prev.map((m) => (m.id === id ? change(m) : m))
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const DEFAULT_PREFS: Prefs = { language: 'en', explain: false, pauseOnBattery: true, theme: 'black', accent: 'mint', userName: '', callMe: '', onboarded: false, scene: '', fast: true }

function loadPrefs(): Prefs {
  try {
    const d = JSON.parse(localStorage.getItem('setu.prefs') ?? '{}')
    return {
      language: ['en', 'hi', 'gu', 'hinglish'].includes(d.language) ? d.language : 'en',
      explain: d.explain === true,
      pauseOnBattery: d.pauseOnBattery !== false,
      theme: (THEMES as readonly string[]).includes(d.theme) ? d.theme : 'black',
      accent: (ACCENTS as readonly string[]).includes(d.accent) ? d.accent : 'mint',
      userName: typeof d.userName === 'string' ? d.userName.slice(0, 40) : '',
      callMe: typeof d.callMe === 'string' ? d.callMe.slice(0, 24) : '',
      onboarded: d.onboarded === true,
      scene: isScene(d.scene) ? d.scene : '',
      fast: d.fast !== false
    }
  } catch {
    return DEFAULT_PREFS
  }
}

const APP_VERSION = '0.1'

const RULES_TEMPLATE = `# Rules for Setu in this project

Setu reads this file every time you chat in this folder. Edit it freely.

- Describe the project in one line here.
- Use simple, readable code and short comments.
- Do not add new libraries unless I ask.
- Reply in short answers.
`


const LANGUAGE_NAMES: Record<string, string> = { hi: 'Hindi', gu: 'Gujarati', hinglish: 'Hinglish' }

export default function App() {
  const [mode, setMode] = useState<Mode>('agent')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [status, setStatus] = useState<Status>('checking')
  const [models, setModels] = useState<OllamaModel[]>([])
  const [model, setModel] = useState<string>(() => localStorage.getItem('setu.model') ?? '')
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [showModels, setShowModels] = useState(false)
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [spaces, setSpaces] = useState<SpacesState>({ spaces: [], active: null })
  const [notice, setNotice] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const shortcutRef = useRef<{ newSession: () => void }>({ newSession: () => undefined })
  const [previewVersion, setPreviewVersion] = useState(0)
  const [showRun, setShowRun] = useState(false)
  const showRunRef = useRef(false)
  showRunRef.current = showRun
  const [showHelp, setShowHelp] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [notesAdd, setNotesAdd] = useState('')
  useEffect(() => {
    const h = (e: Event): void => {
      setNotesAdd(typeof (e as CustomEvent).detail === 'string' ? (e as CustomEvent).detail : '')
      setNotesOpen(true)
    }
    const hi = (): void => setImageOpen(true)
    const hq = (): void => setQaOpen(true)
    const hr = (): void => setReviewsOpen(true)
    window.addEventListener('setu:notes', h)
    window.addEventListener('setu:image', hi)
    window.addEventListener('setu:qa', hq)
    window.addEventListener('setu:reviews', hr)
    return () => {
      window.removeEventListener('setu:notes', h)
      window.removeEventListener('setu:image', hi)
      window.removeEventListener('setu:qa', hq)
      window.removeEventListener('setu:reviews', hr)
    }
  }, [])
  const [projectFiles, setProjectFiles] = useState<string[]>([])
  const [ollamaVersion, setOllamaVersion] = useState('unknown')
  const [canSee, setCanSee] = useState(false)
  const [needVision, setNeedVision] = useState(false)
  const [loop, setLoop] = useState<{ prompt: string; everyMin: number; runs: number; nextAt: number } | null>(null)
  const pendingImgs = useRef<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [wp, setWp] = useState<WallpaperState | null>(null)
  const [wpError, setWpError] = useState('')
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [sessions, setSessions] = useState<SavedSession[]>(loadSessions)
  const [secretWarning, setSecretWarning] = useState<{ text: string; kinds: string[] } | null>(null)
  const [showProviders, setShowProviders] = useState(false)
  const [orHasKey, setOrHasKey] = useState(false)
  const [orModels, setOrModels] = useState<SavedOrModel[]>(loadOrModels)
  const [apiModels, setApiModels] = useState<SavedApiModel[]>(loadApiModels)
  const [apiCount, setApiCount] = useState(0)
  const [cloudAsk, setCloudAsk] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string; download?: string; notes?: string } | null>(null)
  const modelRef = useRef(model)
  modelRef.current = model
  const sessionIdRef = useRef<string | null>(null)
  const activeSpaceRef = useRef<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const lookTimer = useRef<number | undefined>(undefined)

  const activeSpace = spaces.spaces.find((s) => s.path === spaces.active) ?? null
  activeSpaceRef.current = spaces.active

  useEffect(() => {
    void window.setu.openrouter.status().then((s) => setOrHasKey(s.hasKey)).catch(() => undefined)
  }, [])
  useEffect(() => saveOrModels(orModels), [orModels])
  // Ask at start, then every 6 hours while Setu stays open, whether a newer Setu exists.
  useEffect(() => {
    const ask = (): void => {
      void window.setu.update
        .check()
        .then((r) => {
          if (!r.available || !r.version || !r.url) return
          let skipped = ''
          try {
            skipped = localStorage.getItem('setu.updateSkipped') ?? ''
          } catch {
            /* ignore */
          }
          if (skipped !== r.version) setUpdateInfo({ version: r.version, url: r.url, download: r.download, notes: r.notes })
        })
        .catch(() => undefined)
    }
    const first = window.setTimeout(ask, 4000)
    const again = window.setInterval(ask, 6 * 60 * 60 * 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(again)
    }
  }, [])
  // File names for the @ picker; refreshed when the project or its files change.
  useEffect(() => {
    if (!spaces.active) return setProjectFiles([])
    let live = true
    void window.setu.project.list().then((r) => live && setProjectFiles(r.files)).catch(() => live && setProjectFiles([]))
    return () => {
      live = false
    }
  }, [spaces.active, previewVersion])
  useEffect(() => saveApiModels(apiModels), [apiModels])
  useEffect(() => {
    void window.setu.providers.list().then((r) => setApiCount(r.providers.filter((p) => p.hasKey).length)).catch(() => undefined)
  }, [])
  // Models in the picker: the ones on this computer, then the OpenRouter models the user added.
  const allModels: OllamaModel[] = useMemo(
    () => [
      ...models,
      ...orModels.map((m) => ({ name: `or:${m.id}`, size: 0, modified: '' })),
      ...apiModels.map((m) => ({ name: apiModelName(m), size: 0, modified: '' }))
    ],
    [models, orModels, apiModels]
  )

  const refresh = useCallback(async () => {
    setStatus('checking')
    const s = await window.setu.ollama.status()
    setOllamaVersion(s.running ? (s.version ?? 'running') : 'not running')
    if (!s.running) {
      setStatus('down')
      setModels([])
      return
    }
    setStatus('running')
    try {
      const list = await window.setu.ollama.list()
      setModels(list)
      setModel((current) => (isRemoteModel(current) || list.some((m) => m.name === current) ? current : (list[0]?.name ?? '')))
    } catch {
      setModels([])
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.setu.spaces.state().then(setSpaces).catch(() => undefined)
    window.setu.wallpaper.get().then(setWp).catch(() => undefined)
  }, [refresh])

  useEffect(() => {
    try {
      localStorage.setItem('setu.prefs', JSON.stringify(prefs))
    } catch {
      /* storage may be unavailable */
    }
  }, [prefs])

  // Black is the default. The theme and accent are plain attributes that theme.css reads.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme
    root.dataset.accent = prefs.accent
    root.dataset.fast = prefs.fast ? 'on' : 'off'
  }, [prefs.theme, prefs.accent, prefs.fast])

  // Panels get a little more tint when a wallpaper is set, so text stays readable on top of it.
  useEffect(() => {
    document.documentElement.dataset.wallpaper = wp?.url || prefs.scene ? 'on' : 'off'
  }, [wp?.url, prefs.scene])

  const chooseWallpaper = useCallback(async () => {
    setWpError('')
    try {
      setWp(await window.setu.wallpaper.choose())
    } catch (e) {
      setWpError(errorText(e))
    }
  }, [])

  const clearWallpaper = useCallback(async () => {
    setWpError('')
    try {
      setWp(await window.setu.wallpaper.clear())
    } catch (e) {
      setWpError(errorText(e))
    }
  }, [])

  // Sliders move instantly; the choice is saved shortly after the user stops dragging.
  const changeLook = useCallback((dim: number, blur: number) => {
    setWp((prev) => (prev ? { ...prev, dim, blur } : prev))
    window.clearTimeout(lookTimer.current)
    lookTimer.current = window.setTimeout(() => {
      window.setu.wallpaper.setLook({ dim, blur }).catch(() => undefined)
    }, 250)
  }, [])

  useEffect(() => {
    if (model) localStorage.setItem('setu.model', model)
  }, [model])

  // Load the chosen model into memory now, so the first answer does not wait for it.
  useEffect(() => {
    if (!model || isRemoteModel(model) || status !== 'running') return
    const t = window.setTimeout(() => void window.setu.ollama.warm?.(model), 800)
    return () => window.clearTimeout(t)
  }, [model, status])

  const pendingTokens = useRef('')
  const flushTimer = useRef<number | null>(null)
  const flushTokens = useCallback(() => {
    if (flushTimer.current !== null) {
      window.clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const text = pendingTokens.current
    if (!text) return
    pendingTokens.current = ''
    setMessages((prev) => updateLast(prev, (m) => ({ ...m, content: m.content + text })))
  }, [])

  // Replies arrive as a stream of small events from the main process.
  useEffect(
    () =>
      window.setu.ollama.onChatEvent((ev) => {
        if (ev.id !== chatIdRef.current) return
        if (ev.type === 'token') {
          // Redraw at most about 25 times a second, instead of once per word, so long answers stay smooth on slow laptops.
          pendingTokens.current += ev.text
          if (flushTimer.current === null) flushTimer.current = window.setTimeout(flushTokens, 40)
          return
        }
        flushTokens()
        if (ev.type === 'done') {
          setMessages((prev) =>
            updateLast(prev, (m) => ({ ...m, tokens: ev.tokens, stopped: ev.stopped }))
          )
          setStreaming(false)
          chatIdRef.current = null
          // Count cloud tokens for the usage meter. Local models cost nothing, so they are not counted.
          const used = modelRef.current
          if (isRemoteModel(used) || isCloudModel(used)) {
            const u = addUsage(used, ev.promptTokens ?? 0, ev.tokens ?? 0)
            const cap = loadCap()
            if (cap > 0 && totalTokens(u) >= cap * 0.8 && totalTokens(u) - (ev.tokens ?? 0) - (ev.promptTokens ?? 0) < cap * 0.8) {
              setNotice(`You have used ${formatTokens(totalTokens(u))} of your ${formatTokens(cap)} monthly cloud limit.`)
            }
          }
        } else if (ev.type === 'context') {
          setNotice(ev.notice)
        } else {
          setMessages((prev) => updateLast(prev, (m) => ({ ...m, error: ev.message })))
          setStreaming(false)
          chatIdRef.current = null
        }
      }),
    [flushTokens]
  )

  const stop = useCallback(() => {
    if (chatIdRef.current) void window.setu.ollama.stopChat(chatIdRef.current)
  }, [])

  // A session is saved once a reply has finished, never half-way through one.
  useEffect(() => {
    if (streaming || messages.length === 0) return
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
    setSessions(saveSession(sessionIdRef.current, activeSpaceRef.current, messages))
  }, [messages, streaming])

  // Keyboard shortcuts: Ctrl/Cmd+N new session, Ctrl/Cmd+K focus the message box, Ctrl/Cmd+. toggle preview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (e.shiftKey) {
        if (k === 'p') {
          e.preventDefault()
          setShowPalette(true)
        }
        return
      }
      if (k === 'n') {
        e.preventDefault()
        shortcutRef.current.newSession()
      } else if (k === 'k') {
        e.preventDefault()
        window.dispatchEvent(new Event('setu:focus'))
      } else if (k === '.') {
        e.preventDefault()
        setShowRun(false)
        setShowPreview((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const newSession = useCallback(() => {
    stop()
    pendingTokens.current = ''
    sessionIdRef.current = null
    setSecretWarning(null)
    setMessages([])
    setStreaming(false)
    setNotice('')
    chatIdRef.current = null
  }, [stop])

  shortcutRef.current.newSession = newSession

  const openSession = useCallback(
    (id: string) => {
      const s = sessions.find((x) => x.id === id)
      if (!s) return
      stop()
      sessionIdRef.current = s.id
      setSecretWarning(null)
      setNotice(
        s.space && s.space !== spaces.active
          ? 'This session was in another project folder. Pick that folder to keep changing its files.'
          : ''
      )
      setMessages(s.messages)
      setStreaming(false)
    },
    [sessions, spaces.active, stop]
  )

  const removeSession = useCallback((id: string) => setSessions(deleteSession(id)), [])

  const send = useCallback(
    async (text: string, images: string[] = []) => {
      if (streaming) return
      if ((status !== 'running' && !isRemoteModel(model)) || !model) {
        setShowModels(true)
        return
      }
      setNotice('')
      const id = crypto.randomUUID()
      const userMsg: UiMessage = { id: crypto.randomUUID(), role: 'user', content: text, ...(images.length ? { images } : {}) }
      const history = [...messages.filter((m) => !m.error), userMsg]
      // Send at most the 4 newest pictures; older ones would only slow the model down.
      let budget = 4
      const withPics = new Map<string, string[]>()
      for (let i = history.length - 1; i >= 0 && budget > 0; i--) {
        const imgs = history[i].images?.slice(0, budget)
        if (imgs?.length) {
          withPics.set(history[i].id, imgs.map((d) => d.slice(d.indexOf(',') + 1)))
          budget -= imgs.length
        }
      }
      chatIdRef.current = id
      setStreaming(true)
      setMessages([...messages, userMsg, { id: crypto.randomUUID(), role: 'assistant', content: '', model }])
      try {
        await window.setu.ollama.chat({
          id,
          model,
          useProject: !!spaces.active,
          style: { language: prefs.language, explain: prefs.explain, name: prefs.userName, callMe: prefs.callMe, learned: loadLearned() },
          focus: [...text.matchAll(/(?:^|\s)@(\S+)/g)].map((m) => m[1]).filter((f) => projectFiles.includes(f)).slice(0, 3),
          messages: history.map((m) => ({ role: m.role, content: m.content, ...(withPics.has(m.id) ? { images: withPics.get(m.id) } : {}) }))
        })
      } catch (e) {
        setMessages((prev) => updateLast(prev, (m) => ({ ...m, error: errorText(e) })))
        setStreaming(false)
        chatIdRef.current = null
      }
    },
    [messages, model, status, streaming, spaces.active, prefs.language, prefs.explain, prefs.userName, prefs.callMe, projectFiles]
  )

  // Before sending, look for keys and passwords. The text stays in the box if a warning is shown.
  const trySend = useCallback(
    (text: string, images: string[] = []): boolean => {
      pendingImgs.current = images
      setNeedVision(false)
      if (images.length > 0 && !canSee) {
        setNeedVision(true)
        return false
      }
      const kinds = secretKinds(findSecrets(text))
      if (kinds.length > 0) {
        setSecretWarning({ text, kinds })
        return false
      }
      setSecretWarning(null)
      // Stop cloud sends once the monthly limit the user set is reached.
      const cap = loadCap()
      if (cap > 0 && (isRemoteModel(model) || isCloudModel(model)) && totalTokens(loadUsage()) >= cap) {
        setNotice(`Monthly cloud limit reached (${formatTokens(cap)} tokens). Pick a local model, or raise the limit under Providers.`)
        return false
      }
      // Cloud models send the conversation to Ollama's servers, so ask once before the first time.
      if (isCloudModel(model) && !hasCloudConsent()) {
        setCloudAsk(text)
        return false
      }
      void send(text, images)
      return true
    },
    [send, model, canSee]
  )

  const askAgent = useCallback(
    (text: string) => {
      setMode('agent')
      trySend(text, [])
    },
    [trySend]
  )

  // Loop: while one is running, send its prompt again when the last answer is finished and the time is up.
  useEffect(() => {
    if (!loop) return
    const t = setInterval(() => {
      if (streaming || Date.now() < loop.nextAt) return
      if (loop.runs >= LOOP_MAX_RUNS) {
        setLoop(null)
        setNotice(`Loop finished after ${LOOP_MAX_RUNS} runs.`)
        return
      }
      if (trySend(loop.prompt, [])) setLoop({ ...loop, runs: loop.runs + 1, nextAt: Date.now() + loop.everyMin * 60000 })
      else {
        setLoop(null)
        setNotice('Loop stopped because a message could not be sent. Check the warning, then start it again.')
      }
    }, 1500)
    return () => clearInterval(t)
  }, [loop, streaming, trySend])

  // A loop belongs to one project: stop it if the folder changes.
  useEffect(() => setLoop(null), [spaces.active])

  // Intercepts "/loop ..." typed in the message box.
  const sendOrLoop = useCallback(
    (text: string, images: string[] = []): boolean => {
      const cmd = parseLoop(text)
      if (!cmd) return trySend(text, images)
      if (cmd.kind === 'bad') {
        setNotice(cmd.reason)
        return false
      }
      if (cmd.kind === 'stop') {
        setLoop(null)
        setNotice(loop ? 'Loop stopped.' : 'No loop is running.')
        return true
      }
      setNotice(`Loop started: every ${everyLabel(cmd.everyMin)}, up to ${LOOP_MAX_RUNS} runs, only while Setu is open. Setu still asks before saving any file.`)
      setLoop({ prompt: cmd.prompt, everyMin: cmd.everyMin, runs: 0, nextAt: Date.now() })
      return true
    },
    [trySend, loop]
  )

  const writeCommit = useCallback(async () => {
    const r = await window.setu.git.state().catch(() => null)
    if (!r) return setNotice('Could not read your changes.')
    if (!r.ok) return setNotice(r.reason === 'no-git' ? 'Git is not installed on this computer.' : 'This folder is not a Git project yet.')
    if (r.changed === 0) return setNotice('No changes to commit.')
    trySend(
      `Write a git commit message for these changes. Give one short title line (under 70 characters), then a blank line, then 2 to 4 short bullet points.${r.truncated ? ' The diff was cut because it is long.' : ''}\n\n\`\`\`diff\n${r.diff}\n\`\`\``,
      []
    )
  }, [trySend])

  const addRules = useCallback(async () => {
    const r = await window.setu.project.read('SETU.md').catch(() => null)
    if (r && r.exists) {
      setMode('editor')
      return setNotice('SETU.md already exists. Edit it in the Editor tab.')
    }
    try {
      await window.setu.project.apply({ label: 'Add SETU.md', changes: [{ path: 'SETU.md', content: RULES_TEMPLATE }] })
      setPreviewVersion((v) => v + 1)
      setNotice('Created SETU.md. Open the Editor tab to write your rules. Setu follows them in every chat for this project.')
    } catch (e) {
      setNotice(errorText(e))
    }
  }, [])

  // ---- project folders ----
  const addSpace = useCallback(async () => {
    try {
      const next = await window.setu.spaces.add()
      if (next.active !== spaces.active) newSession()
      setSpaces(next)
    } catch (e) {
      setNotice(errorText(e))
    }
  }, [spaces.active, newSession])

  const selectSpace = useCallback(
    async (path: string) => {
      if (path === spaces.active) return
      try {
        setSpaces(await window.setu.spaces.select(path))
        newSession()
      } catch (e) {
        setNotice(errorText(e))
      }
    },
    [spaces.active, newSession]
  )

  const removeSpace = useCallback(
    async (path: string) => {
      try {
        const wasActive = path === spaces.active
        setSpaces(await window.setu.spaces.remove(path))
        if (wasActive) newSession()
      } catch (e) {
        setNotice(errorText(e))
      }
    },
    [spaces.active, newSession]
  )

  // ---- proposed file changes ----
  const firstUser = messages.find((m) => m.role === 'user')?.content
  const label = (firstUser ?? 'Change').replace(/\s+/g, ' ').slice(0, 60)

  const applyChanges = useCallback(
    async (messageId: string, changes: { path: string; content: string }[]) => {
      try {
        const r = await window.setu.project.apply({ label, changes })
        setPreviewVersion((v) => v + 1)
        if (r.written.some((p) => /\.html?$/i.test(p)) && !showRunRef.current) setShowPreview(true)
        setMessages((prev) =>
          updateById(prev, messageId, (m) => ({
            ...m,
            proposal: { status: 'applied', checkpointId: r.checkpointId, written: r.written }
          }))
        )
      } catch (e) {
        setMessages((prev) =>
          updateById(prev, messageId, (m) => ({ ...m, proposal: { status: 'pending', error: errorText(e) } }))
        )
      }
    },
    [label]
  )

  const rejectChanges = useCallback((messageId: string) => {
    setMessages((prev) => updateById(prev, messageId, (m) => ({ ...m, proposal: { status: 'rejected' } })))
  }, [])

  const undoChanges = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId)
      const id = target?.proposal?.checkpointId
      if (!id) return
      try {
        await window.setu.checkpoints.restore(id)
        setPreviewVersion((v) => v + 1)
        setMessages((prev) =>
          updateById(prev, messageId, (m) => ({ ...m, proposal: { ...m.proposal!, status: 'undone' } }))
        )
      } catch (e) {
        setMessages((prev) =>
          updateById(prev, messageId, (m) => ({ ...m, proposal: { ...m.proposal!, error: errorText(e) } }))
        )
      }
    },
    [messages]
  )

  useEffect(() => {
    let live = true
    setCanSee(false)
    if (isOpenRouter(model)) setCanSee(!!orModels.find((m) => `or:${m.id}` === model)?.vision)
    else if (model.startsWith('api:')) setCanSee(!!apiModels.find((m) => apiModelName(m) === model)?.vision)
    else if (model) void window.setu.ollama.vision(model).then((v) => live && setCanSee(!!v)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [model, orModels, apiModels])

  const title = firstUser ? (firstUser.length > 40 ? `${firstUser.slice(0, 40)}…` : firstUser) : 'New session'

  const paletteActions: PaletteAction[] = [
    { id: 'new', label: 'New session', hint: 'Ctrl+N', run: newSession },
    { id: 'agent', label: 'Go to chat', run: () => setMode('agent') },
    { id: 'editor', label: 'Open Editor', run: () => setMode('editor') },
    { id: 'search', label: 'Search in files', run: () => setMode('editor') },
    { id: 'preview', label: 'Toggle preview', hint: 'Ctrl+.', run: () => { setShowRun(false); setShowPreview((v) => !v) } },
    { id: 'run', label: 'Toggle Run panel', run: () => { setShowPreview(false); setShowRun((v) => !v) } },
    { id: 'commit', label: 'Write commit message', run: () => void writeCommit() },
    { id: 'rules', label: 'Add project rules (SETU.md)', run: () => void addRules() },
    ...(loop ? [{ id: 'loopstop', label: 'Stop the loop', run: () => setLoop(null) }] : []),
    { id: 'image', label: 'Make an image (Cloudflare, free)', run: () => setImageOpen(true) },
    { id: 'qa', label: 'Test like a person (beta)', run: () => setQaOpen(true) },
    { id: 'report', label: 'Report a problem', run: () => setReportOpen(true) },
    { id: 'reviews', label: 'Reviews: see and write', run: () => setReviewsOpen(true) },
    { id: 'notes', label: 'Project notes (Setu remembers)', run: () => { setNotesAdd(''); setNotesOpen(true) } },
    { id: 'tour', label: 'Tour my project', run: () => askAgent('Give me a short, simple tour of this project: what it does, the main files and what each one is for, and how to run it. If something looks broken or missing, tell me.') },
    { id: 'models', label: 'Manage models', run: () => setShowModels(true) },
    { id: 'providers', label: 'Providers and usage', run: () => setShowProviders(true) },
    { id: 'checkpoints', label: 'Checkpoints (undo points)', run: () => setShowCheckpoints(true) },
    { id: 'settings', label: 'Settings', run: () => setShowSettings(true) },
    { id: 'help', label: 'Help', run: () => setShowHelp(true) },
    { id: 'sidebar', label: 'Show or hide sidebar', run: () => setSidebarOpen((o) => !o) },
    ...THEMES.map((t) => ({ id: `theme-${t}`, label: `Theme: ${t}`, run: () => setPrefs((p) => ({ ...p, theme: t })) }))
  ]

  const composer = (
    <Composer
      models={allModels}
      files={projectFiles}
      model={model}
      onModelChange={setModel}
      onManageModels={() => setShowModels(true)}
      onSend={sendOrLoop}
      onStop={stop}
      streaming={streaming}
      projectName={activeSpace?.name ?? null}
      styleChips={[...(prefs.language !== 'en' ? [LANGUAGE_NAMES[prefs.language]] : []), ...(prefs.explain ? ['Teaching'] : [])]}
      placeholder={messages.length > 0 ? 'Reply…' : undefined}
    />
  )

  return (
    <div className="app">
      <Wallpaper wp={wp} scene={prefs.scene} fast={prefs.fast} light={prefs.theme === 'light'} pauseOnBattery={prefs.pauseOnBattery} busy={streaming} words={projectFiles} />
      <TitleBar
        mode={mode}
        onModeChange={setMode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        title={title}
        previewOpen={showPreview}
        onTogglePreview={() => {
          setShowRun(false)
          setShowPreview((o) => !o)
        }}
        runOpen={showRun}
        onToggleRun={() => {
          setShowPreview(false)
          setShowRun((o) => !o)
        }}
      />
      <div className="body">
        {sidebarOpen && (
          <Sidebar
            spaces={spaces}
            onNewSession={newSession}
            onAddSpace={() => void addSpace()}
            onSelectSpace={(p) => void selectSpace(p)}
            onRemoveSpace={(p) => void removeSpace(p)}
            onOpenCheckpoints={() => setShowCheckpoints(true)}
            onOpenSettings={() => setShowSettings(true)}
            providerCount={(orHasKey ? 1 : 0) + apiCount}
            onOpenHelp={() => setShowHelp(true)}
            onOpenProviders={() => setShowProviders(true)}
          />
        )}
        <main className="main">
          {mode === 'agent' ? (
            <>
              {!isRemoteModel(model) && !(messages.length === 0 && status === 'running' && models.length === 0) && (
                <StatusBanner
                  status={status}
                  hasModels={models.length > 0}
                  onRetry={() => void refresh()}
                  onManage={() => setShowModels(true)}
                />
              )}
              {cloudAsk !== null && (
                <div className="banner warn secret-warning" role="alert">
                  <span>
                    <strong>{model}</strong> runs on {isOpenRouter(model) ? "OpenRouter's and the model company's" : isRemoteModel(model) ? 'the model company\'s' : "Ollama's"} servers, not on your computer. Your messages
                    {activeSpace ? ', the project files Setu shows the model,' : ''} and any screenshots you attach are sent to {isRemoteModel(model) ? 'them' : 'Ollama'} while you use it.
                    Choose a local model if that's not OK.
                  </span>
                  <span className="secret-actions">
                    <button className="banner-btn" onClick={() => setCloudAsk(null)}>
                      Cancel
                    </button>
                    <button
                      className="banner-btn"
                      onClick={() => {
                        const t = cloudAsk
                        saveCloudConsent()
                        setCloudAsk(null)
                        void send(t, pendingImgs.current)
                      }}
                    >
                      Use cloud model
                    </button>
                  </span>
                </div>
              )}
              {secretWarning && (
                <div className="banner warn secret-warning" role="alert">
                  <span>
                    This message looks like it contains a {secretWarning.kinds.join(' and ')}. It stays on your
                    computer while Setu is local only, but it would be sent out if you use a cloud model. Setu hides
                    keys like this in saved sessions.
                  </span>
                  <span className="secret-actions">
                    <button className="banner-btn" onClick={() => setSecretWarning(null)}>
                      Edit message
                    </button>
                    <button
                      className="banner-btn"
                      onClick={() => {
                        const t = secretWarning.text
                        setSecretWarning(null)
                        void send(t, pendingImgs.current)
                      }}
                    >
                      Send anyway
                    </button>
                  </span>
                </div>
              )}
              {needVision && (
                <div className="banner warn secret-warning" role="alert">
                  <span>
                    <strong>{model || 'This model'}</strong> can't read pictures. Pick a model that can, such as gemma3:4b,
                    then send again. Your screenshot is still attached.
                  </span>
                  <span className="secret-actions">
                    <button className="banner-btn" onClick={() => setNeedVision(false)}>
                      Dismiss
                    </button>
                    <button
                      className="banner-btn"
                      onClick={() => {
                        setNeedVision(false)
                        setShowModels(true)
                      }}
                    >
                      Manage models
                    </button>
                  </span>
                </div>
              )}
              {updateInfo && (
                <div className="banner warn" role="status">
                  <span>Setu {updateInfo.version} is available.{updateInfo.notes ? ` ${updateInfo.notes}` : ''}</span>
                  <span className="secret-actions">
                    <button
                      className="banner-btn"
                      onClick={() => {
                        try {
                          localStorage.setItem('setu.updateSkipped', updateInfo.version)
                        } catch {
                          /* ignore */
                        }
                        setUpdateInfo(null)
                      }}
                    >
                      Later
                    </button>
                    <button className="banner-btn" onClick={() => void window.setu.update.open(updateInfo.download || updateInfo.url)}>
                      Download
                    </button>
                  </span>
                </div>
              )}
              {loop && (
                <div className="banner loop-banner">
                  <span>
                    Loop · every {everyLabel(loop.everyMin)} · run {loop.runs} of {LOOP_MAX_RUNS} · {loop.prompt.slice(0, 50)}
                  </span>
                  <button className="banner-btn" onClick={() => setLoop(null)}>
                    Stop loop
                  </button>
                </div>
              )}
              {notice && (
                <div className="banner warn">
                  <span>{notice}</span>
                  <button className="banner-btn" onClick={() => setNotice('')}>
                    Dismiss
                  </button>
                </div>
              )}
              {messages.length === 0 ? (
                <Home
                  composer={composer}
                  banner={
                    status === 'running' && models.length === 0 ? (
                      <FirstRun onDone={() => void refresh()} onOpenModels={() => setShowModels(true)} />
                    ) : null
                  }
                  greeting={greetingName(prefs.userName, prefs.callMe)}
                  spaceName={activeSpace?.name ?? null}
                  onAddSpace={() => void addSpace()}
                  sessions={sessions}
                  onOpenSession={openSession}
                  onDeleteSession={removeSession}
                  onCommit={() => void writeCommit()}
                  onRules={() => void addRules()}
                  onTour={() =>
                    void send(
                      'Give me a short, simple tour of this project: what it does, the main files and what each one is for, and how to run it. If something looks broken or missing, tell me.'
                    )
                  }
                />
              ) : (
                <Session
                  messages={messages}
                  streaming={streaming}
                  composer={composer}
                  handlers={{
                    hasSpace: !!activeSpace,
                    onApply: (id, changes) => void applyChanges(id, changes),
                    onReject: rejectChanges,
                    onUndo: (id) => void undoChanges(id)
                  }}
                />
              )}
            </>
          ) : (
            <EditorPane spaceName={activeSpace?.name ?? null} version={previewVersion} onSaved={() => setPreviewVersion((v) => v + 1)} onAsk={askAgent} />
          )}
        </main>
        {showRun && mode === 'agent' && (
          <RunPanel
            spaceName={activeSpace?.name ?? null}
            version={previewVersion}
            onClose={() => setShowRun(false)}
            onFix={(command, output, code) => trySend(fixPrompt(command, output, code), [])}
            onExplain={(command, output, code) => trySend(explainPrompt(command, output, code), [])}
          />
        )}
        {showPreview && mode === 'agent' && (
          <PreviewPanel spaceName={activeSpace?.name ?? null} version={previewVersion} onClose={() => setShowPreview(false)} />
        )}
      </div>
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} actions={paletteActions} />
      <ModelManager
        open={showModels}
        onClose={() => setShowModels(false)}
        status={status}
        models={models}
        onRefresh={() => void refresh()}
      />
      {!prefs.onboarded && (
        <Welcome onDone={(name, callMe) => setPrefs((p) => ({ ...p, userName: name, callMe, onboarded: true }))} />
      )}
      <ProvidersModal
        open={showProviders}
        onClose={() => setShowProviders(false)}
        hasKey={orHasKey}
        onKeyChange={setOrHasKey}
        saved={orModels}
        onSaved={setOrModels}
        apiModels={apiModels}
        onApiModels={setApiModels}
        onApiCount={setApiCount}
      />
      <ReviewsModal open={reviewsOpen} onClose={() => setReviewsOpen(false)} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
      <QaModal
        open={qaOpen}
        onClose={() => setQaOpen(false)}
        model={model}
        hasProject={!!activeSpace}
        onSendToChat={(text) => window.dispatchEvent(new CustomEvent('setu:prefill', { detail: text }))}
      />
      <ImageModal open={imageOpen} onClose={() => setImageOpen(false)} spaceName={activeSpace?.name ?? null} />
      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} spaceName={activeSpace?.name ?? null} add={notesAdd} onSaved={setNotice} />
      <HelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        version={APP_VERSION}
        model={model}
        modelCount={models.length}
        ollama={ollamaVersion}
      />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        wp={wp}
        wpError={wpError}
        onChooseWallpaper={() => void chooseWallpaper()}
        onClearWallpaper={() => void clearWallpaper()}
        onLook={changeLook}
        prefs={prefs}
        onPrefs={setPrefs}
      />
      <CheckpointsModal
        open={showCheckpoints}
        onClose={() => setShowCheckpoints(false)}
        spaceName={activeSpace?.name ?? null}
        onRestored={() => undefined}
      />
    </div>
  )
}
