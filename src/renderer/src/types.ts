export type Mode = 'agent' | 'editor'

export type OllamaModel = { name: string; size: number; modified: string }

export type ChatMsg = { role: 'user' | 'assistant'; content: string; images?: string[] }

export type Space = { path: string; name: string }
export type SpacesState = { spaces: Space[]; active: string | null }

export type FileRead =
  | { exists: false }
  | { exists: true; binary: true }
  | { exists: true; binary: false; content: string }

export type CheckpointInfo = {
  id: string
  label: string
  createdAt: string
  files: { path: string; existed: boolean }[]
}

export type Proposal = {
  status: 'pending' | 'applied' | 'rejected' | 'undone'
  checkpointId?: string
  written?: string[]
  error?: string
}

export type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Screenshots attached to this message (data URLs). Kept only while the session is open. */
  images?: string[]
  /** How many screenshots were attached, kept after the pictures themselves are dropped from saved sessions. */
  hadImages?: number
  model?: string
  tokens?: number
  stopped?: boolean
  error?: string
  proposal?: Proposal
}

export type ChatEvent =
  | { id: string; type: 'token'; text: string }
  | { id: string; type: 'done'; tokens?: number; promptTokens?: number; stopped?: boolean }
  | { id: string; type: 'context'; notice: string }
  | { id: string; type: 'error'; message: string }

export type PullEvent =
  | { name: string; type: 'progress'; status: string; total?: number; completed?: number }
  | { name: string; type: 'done' }
  | { name: string; type: 'error'; message: string }

export type WallpaperState = {
  kind: 'image' | 'video' | null
  dim: number
  blur: number
  version: number
  url: string | null
}

export type Language = 'en' | 'hi' | 'gu' | 'hinglish'
export const THEMES = ['black', 'midnight', 'graphite', 'plum', 'forest', 'light'] as const
export const ACCENTS = ['mint', 'blue', 'violet', 'amber', 'rose'] as const
export type ThemeId = (typeof THEMES)[number]
export type AccentId = (typeof ACCENTS)[number]
export type Prefs = {
  language: Language
  explain: boolean
  pauseOnBattery: boolean
  theme: ThemeId
  accent: AccentId
  /** What the user told Setu at first run. Used only to address them. Stays on this computer (and goes to the model they chose). */
  userName: string
  /** A title like Sir or Buddy. Empty means "use my name". */
  callMe: string
  /** True once the welcome questions have been answered or skipped. */
  onboarded: boolean
  /** A built-in wallpaper id, or empty for none. A wallpaper the user chose themselves wins over it. */
  scene: string
  /** Fast and flat look: no blur, no glow, no moving background. On by default. Turn it off for the glass look. */
  fast: boolean
}
