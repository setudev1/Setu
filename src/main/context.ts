// Keeps the chat inside the model's memory window. Local models get a fixed window (8,192 tokens);
// without trimming, Ollama silently drops the oldest text, which can be the project files themselves.
// Here Setu drops the oldest chat messages instead, and tells the user.
import { totalmem } from 'os'
import type { ChatMessage } from './ollama'

export const LOCAL_WINDOW = 8192

/** A bigger memory window when the PC has more RAM, so whole-file answers do not fill the chat quickly. */
export function localWindow(ramBytes: number = totalmem()): number {
  const gb = ramBytes / 1024 ** 3
  if (gb <= 8.5) return LOCAL_WINDOW
  if (gb <= 16.5) return 12288
  return 16384
}
const REPLY_ROOM = 1500 // room kept free for the model's answer
const CLOUD_HISTORY = 24000 // chat history sent to API and OpenRouter models, so long chats do not get expensive
const OLLAMA_CLOUD_HISTORY = 16000
const IMAGE_TOKENS = 700
const MIN_HISTORY = 1000 // even a crowded window keeps at least the newest message

/** About 4 characters per token, which is close enough for English and code. */
export const estimateTokens = (text: string): number => Math.ceil((text ?? '').length / 4) + 4

export const messageTokens = (m: ChatMessage): number => estimateTokens(m.content) + (m.images?.length ?? 0) * IMAGE_TOKENS

export type Fit = {
  messages: ChatMessage[]
  dropped: number
  /** Estimated tokens used (instructions + chat) and the limit they are measured against. */
  used: number
  limit: number
}

/** How many tokens of chat history this model may receive, given the instructions already taking space. */
export function historyBudget(model: string, systemTokens: number, win: number = LOCAL_WINDOW): { budget: number; limit: number } {
  if (model.startsWith('api:') || model.startsWith('or:')) return { budget: CLOUD_HISTORY, limit: CLOUD_HISTORY + systemTokens }
  if (/[:-]cloud$/i.test(model)) return { budget: OLLAMA_CLOUD_HISTORY, limit: OLLAMA_CLOUD_HISTORY + systemTokens }
  return { budget: Math.max(MIN_HISTORY, win - REPLY_ROOM - systemTokens), limit: win }
}

/** Drops the oldest messages until the chat fits. The newest message is always kept, and the chat starts with the user. */
export function fitHistory(messages: ChatMessage[], budget: number, systemTokens: number, limit: number): Fit {
  const chat = messages.filter((m) => m.role !== 'system')
  let total = chat.reduce((a, m) => a + messageTokens(m), 0)
  let start = 0
  while (start < chat.length - 1 && total > budget) {
    total -= messageTokens(chat[start])
    start++
  }
  while (start < chat.length - 1 && chat[start].role !== 'user') {
    total -= messageTokens(chat[start])
    start++
  }
  return { messages: chat.slice(start), dropped: start, used: systemTokens + total, limit }
}

/** The line shown to the user, or null when there is nothing to say. */
export function contextNotice(f: Fit, local: boolean): string | null {
  if (f.dropped > 0) {
    return `This chat is long, so Setu left out the oldest ${f.dropped} message${f.dropped > 1 ? 's' : ''} to fit the model's memory. For best results, start a new session.`
  }
  if (local && f.used >= f.limit * 0.8) return "This chat is nearly filling the model's memory. Start a new session soon, or pick a cloud model with more memory."
  return null
}
