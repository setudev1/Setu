// OpenRouter: one account that can reach hundreds of cloud models. The user brings their own key.
// The key is encrypted with the operating system's own protection (Windows DPAPI) and never leaves the main process.
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { readLines } from './ollama'
import type { ChatMessage } from './ollama'

const BASE = 'https://openrouter.ai/api/v1'
const keyFile = (): string => join(app.getPath('userData'), 'openrouter.key')

export type OrModel = { id: string; name: string; free: boolean; vision: boolean; context: number }

function readKey(): string | null {
  try {
    if (!existsSync(keyFile()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(Buffer.from(readFileSync(keyFile(), 'utf8'), 'base64'))
  } catch {
    return null
  }
}

export const hasKey = (): boolean => readKey() !== null

export function setKey(key: unknown): void {
  if (typeof key !== 'string') throw new Error('Paste your OpenRouter key.')
  const k = key.trim()
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(k)) throw new Error("That doesn't look like an OpenRouter key. It starts with sk-or-.")
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("This computer can't protect the key safely, so Setu won't save it.")
  }
  writeFileSync(keyFile(), safeStorage.encryptString(k).toString('base64'), { mode: 0o600 })
}

export function clearKey(): void {
  try {
    unlinkSync(keyFile())
  } catch {
    /* already gone */
  }
}

let cache: { at: number; models: OrModel[] } | null = null

export async function listOrModels(): Promise<OrModel[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.models
  const res = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error("Couldn't load the OpenRouter model list. Check your internet and try again.")
  const body = (await res.json()) as { data?: Array<Record<string, any>> } // eslint-disable-line @typescript-eslint/no-explicit-any
  const models = (body.data ?? [])
    .filter((m) => typeof m.id === 'string')
    .map((m) => ({
      id: String(m.id),
      name: String(m.name ?? m.id),
      free: Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0,
      vision: Array.isArray(m.architecture?.input_modalities) && m.architecture.input_modalities.includes('image'),
      context: Number(m.context_length) || 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  cache = { at: Date.now(), models }
  return models
}

async function orError(res: Response): Promise<string> {
  if (res.status === 401) return "OpenRouter didn't accept your key. Open Providers and paste it again."
  if (res.status === 402) return 'This model needs credits on your OpenRouter account. Add credits, or pick a model marked free.'
  if (res.status === 429) return 'OpenRouter says too many requests right now. Free models have daily and per-minute limits that OpenRouter sets and can change. Wait a while, pick another model, or switch to a model on this computer.'
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    if (j.error?.message) return `OpenRouter: ${j.error.message}`
  } catch {
    /* fall through */
  }
  return `OpenRouter returned an error (${res.status}).`
}

export async function streamOpenRouter(opts: {
  model: string // the OpenRouter id, without the "or:" prefix
  messages: ChatMessage[]
  system: string
  signal: AbortSignal
  onToken: (text: string) => void
  onDone: (info: { tokens?: number; promptTokens?: number }) => void
}): Promise<void> {
  const key = readKey()
  if (!key) throw new Error('Add your OpenRouter key first. Open Providers in the sidebar.')
  const messages = [
    { role: 'system', content: opts.system },
    ...opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) =>
        m.images?.length
          ? {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                ...m.images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }))
              ]
            }
          : { role: m.role, content: m.content }
      )
  ]
  const res = await fetch(`${BASE}/chat/completions`, {
    redirect: 'error', // never follow a redirect with the key attached
    method: 'POST',
    signal: opts.signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Setu' },
    body: JSON.stringify({ model: opts.model, stream: true, usage: { include: true }, messages })
  })
  if (!res.ok) throw new Error(await orError(res))

  let tokens: number | undefined
  let promptTokens: number | undefined
  for await (const raw of readLines(res)) {
    const line = raw.trim()
    if (!line.startsWith('data:')) continue // blank lines and ": OPENROUTER PROCESSING" keep-alives
    const data = line.slice(5).trim()
    if (data === '[DONE]') break
    let obj: any // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      obj = JSON.parse(data)
    } catch {
      continue
    }
    if (obj.error) throw new Error(`OpenRouter: ${obj.error.message ?? 'the model stopped with an error.'}`)
    const piece = obj.choices?.[0]?.delta?.content
    if (typeof piece === 'string' && piece) opts.onToken(piece)
    if (obj.usage) {
      tokens = obj.usage.completion_tokens
      promptTokens = obj.usage.prompt_tokens
    }
  }
  opts.onDone({ tokens, promptTokens })
}
