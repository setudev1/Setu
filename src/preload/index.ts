import { contextBridge, ipcRenderer } from 'electron'

// The only things the interface can see from the system. Keep this list small.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subscribe(channel: string, callback: (payload: any) => void): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (_event: unknown, payload: any): void => callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('setu', {
  platform: process.platform,
  ollama: {
    status: () => ipcRenderer.invoke('ollama:status'),
    list: () => ipcRenderer.invoke('ollama:list'),
    vision: (model: string) => ipcRenderer.invoke('ollama:vision', model),
    chat: (req: unknown) => ipcRenderer.invoke('chat:start', req),
    stopChat: (id: string) => ipcRenderer.invoke('chat:stop', id),
    warm: (model: string) => ipcRenderer.invoke('ollama:warm', model),
    pull: (name: string) => ipcRenderer.invoke('pull:start', name),
    cancelPull: (name: string) => ipcRenderer.invoke('pull:cancel', name),
    onChatEvent: (cb: (payload: unknown) => void) => subscribe('chat:event', cb),
    onPullEvent: (cb: (payload: unknown) => void) => subscribe('pull:event', cb)
  },
  share: { capture: (rect: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('share:capture', rect) },
  git: { state: () => ipcRenderer.invoke('git:state') },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    open: (url: string) => ipcRenderer.invoke('update:open', url)
  },
  setup: {
    installed: () => ipcRenderer.invoke('ollama:installed'),
    start: () => ipcRenderer.invoke('ollama:start'),
    install: () => ipcRenderer.invoke('ollama:setup'),
    cancel: () => ipcRenderer.invoke('ollama:setup-cancel'),
    onEvent: (cb: (payload: unknown) => void) => subscribe('ollama:setup-event', cb)
  },
  run: {
    state: () => ipcRenderer.invoke('run:state'),
    trust: () => ipcRenderer.invoke('run:trust'),
    start: (command: string) => ipcRenderer.invoke('run:start', command),
    stop: () => ipcRenderer.invoke('run:stop'),
    onEvent: (cb: (payload: unknown) => void) => subscribe('run:event', cb)
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    save: (req: unknown) => ipcRenderer.invoke('providers:save', req),
    remove: (id: string) => ipcRenderer.invoke('providers:remove', id)
  },
  openrouter: {
    status: () => ipcRenderer.invoke('or:status'),
    setKey: (key: string) => ipcRenderer.invoke('or:setKey', key),
    clearKey: () => ipcRenderer.invoke('or:clearKey'),
    models: () => ipcRenderer.invoke('or:models')
  },
  system: {
    info: () => ipcRenderer.invoke('system:info')
  },
  spaces: {
    state: () => ipcRenderer.invoke('spaces:state'),
    add: () => ipcRenderer.invoke('spaces:add'),
    select: (folder: string) => ipcRenderer.invoke('spaces:select', folder),
    remove: (folder: string) => ipcRenderer.invoke('spaces:remove', folder),
    reveal: () => ipcRenderer.invoke('spaces:reveal')
  },
  wallpaper: {
    get: () => ipcRenderer.invoke('wallpaper:get'),
    choose: () => ipcRenderer.invoke('wallpaper:choose'),
    clear: () => ipcRenderer.invoke('wallpaper:clear'),
    setLook: (look: unknown) => ipcRenderer.invoke('wallpaper:look', look)
  },
  project: {
    read: (path: string) => ipcRenderer.invoke('project:read', path),
    list: () => ipcRenderer.invoke('project:list'),
    search: (q: string) => ipcRenderer.invoke('project:search', q),
    apply: (req: unknown) => ipcRenderer.invoke('project:apply', req)
  },
  report: {
    log: (message: string) => ipcRenderer.invoke('report:log', message),
    open: (note: string) => ipcRenderer.invoke('report:open', note)
  },
  reviews: {
    list: () => ipcRenderer.invoke('reviews:list'),
    write: (stars: number, text: string) => ipcRenderer.invoke('reviews:write', stars, text)
  },
  qa: {
    start: (req: { id: string; model: string; target: string; goal: string }) => ipcRenderer.invoke('qa:start', req),
    stop: (id: string) => ipcRenderer.invoke('qa:stop', id),
    onEvent: (cb: (payload: unknown) => void) => subscribe('qa:event', cb)
  },
  image: {
    status: () => ipcRenderer.invoke('image:status'),
    setKey: (account: string, token: string) => ipcRenderer.invoke('image:setkey', account, token),
    clear: () => ipcRenderer.invoke('image:clear'),
    make: (prompt: string) => ipcRenderer.invoke('image:make', prompt)
  },
  notes: {
    get: () => ipcRenderer.invoke('notes:get'),
    set: (text: string) => ipcRenderer.invoke('notes:set', text)
  },
  checkpoints: {
    list: () => ipcRenderer.invoke('checkpoints:list'),
    restore: (id: string) => ipcRenderer.invoke('checkpoints:restore', id)
  }
})
