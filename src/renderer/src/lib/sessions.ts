// Saved sessions: kept in this app's local storage on the person's own computer.
import type { UiMessage } from '../types'
import { redactSecrets } from './secrets'

export type SavedSession = {
  id: string
  title: string
  space: string | null
  updatedAt: number
  messages: UiMessage[]
}

const KEY = 'setu.sessions'
const MAX_SESSIONS = 30

export function loadSessions(): SavedSession[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(list)) return []
    return list.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.messages))
  } catch {
    return []
  }
}

function write(list: SavedSession[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function sessionTitle(messages: UiMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content ?? 'Session'
  const t = redactSecrets(first).replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
}

/** Saves (or updates) a session. Keys and passwords are hidden first. Returns the new list. */
export function saveSession(id: string, space: string | null, messages: UiMessage[]): SavedSession[] {
  const clean = messages
    .filter((m) => !(m.role === 'assistant' && m.content === '' && !m.error))
    // Pictures are not saved: they are big and can show private data. We only remember that there was one.
    .map((m) => ({ ...m, content: redactSecrets(m.content), images: undefined, hadImages: m.images?.length ?? m.hadImages }))
  const entry: SavedSession = { id, title: sessionTitle(messages), space, updatedAt: Date.now(), messages: clean }
  let list = [entry, ...loadSessions().filter((s) => s.id !== id)].slice(0, MAX_SESSIONS)
  // If storage is full, drop the oldest sessions until it fits.
  while (!write(list) && list.length > 1) list = list.slice(0, -1)
  return list
}

export function deleteSession(id: string): SavedSession[] {
  const list = loadSessions().filter((s) => s.id !== id)
  write(list)
  return list
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
