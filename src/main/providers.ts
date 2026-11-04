// Your own API keys for other AI companies (OpenAI, Anthropic Claude, Google Gemini, Groq, DeepSeek, Mistral, or any
// OpenAI-compatible address). Keys are encrypted with the operating system's protection and stay in the main process.
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { readLines } from './ollama'
import type { ChatMessage } from './ollama'

export type ProviderKind = 'openai' | 'anthropic'
export type Provider = { id: string; label: string; kind: ProviderKind; baseUrl: string }

export const PRESETS: Provider[] = [
  { id: 'openai', label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com' },
  { id: 'gemini', label: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'groq', label: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'deepseek', label: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'mistral', label: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1' }
]

const listFile = (): string => join(app.getPath('userData'), 'providers.json')
const keyFile = (id: string): string => join(app.getPath('userData'), `provider-${id}.key`)
const ID_RE = /^[a-z0-9-]{1,40}$/

function readList(): Provider[] {
  try {
    const v = JSON.parse(readFileSync(listFile(), 'utf8'))
    return Array.isArray(v)
      ? v.filter((p) => p && ID_RE.test(p.id) && typeof p.label === 'string' && typeof p.baseUrl === 'string' && (p.kind === 'openai' || p.kind === 'anthropic'))
      : []
  } catch {
    return []
  }
}

function readKey(id: string): string | null {
  try {
    if (!ID_RE.test(id) || !existsSync(keyFile(id)) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(Buffer.from(readFileSync(keyFile(id), 'utf8'), 'base64'))
  } catch {
    return null
  }
}

export function listProviders(): (Provider & { hasKey: boolean })[] {
  return readList().map((p) => ({ ...p, hasKey: readKey(p.id) !== null }))
}

// Only https addresses, or http on this same computer (for tools like LM Studio).
function cleanBaseUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter the provider address.')
  let u: URL
  try {
    u = new URL(value.trim())
  } catch {
    throw new Error("That address doesn't look right. Example: https://api.example.com/v1")
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new Error('The address must start with https:// (http:// is only allowed for localhost).')
  }
  if (u.username || u.password) throw new Error('Do not put a password in the address. Use the key box.')
  return u.origin + u.pathname.replace(/\/+$/, '')
}

export function saveProvider(req: unknown): void {
  const r = (req ?? {}) as { presetId?: unknown; label?: unknown; baseUrl?: unknown; kind?: unknown; key?: unknown }
  if (typeof r.key !== 'string' || !/^[\x21-\x7E]{8,400}$/.test(r.key.trim())) {
    throw new Error("That doesn't look like an API key. Paste it without spaces.")
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error("This computer can't protect the key safely, so Setu won't save it.")
  let p: Provider
  const preset = PRESETS.find((x) => x.id === r.presetId)
  if (preset) {
    p = preset
  } else {
    const label = typeof r.label === 'string' ? r.label.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40) : ''
    if (!label) throw new Error('Give this provider a name.')
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'x'}`
    p = { id, label, kind: 'openai', baseUrl: cleanBaseUrl(r.baseUrl) }
  }
  const list = readList().filter((x) => x.id !== p.id)
  writeFileSync(listFile(), JSON.stringify([...list, p], null, 2))
  writeFileSync(keyFile(p.id), safeStorage.encryptString(r.key.trim()).toString('base64'), { mode: 0o600 })
}

export function removeProvider(id: unknown): void {
  if (typeof id !== 'string' || !ID_RE.test(id)) return
  try {
    unlinkSync(keyFile(id))
  } catch {
    /* already gone */
  }
  writeFileSync(listFile(), JSON.stringify(readList().filter((p) => p.id !== id), null, 2))
}

async function apiError(res: Response, label: string): Promise<string> {
  if (res.status === 401 || res.status === 403) return `${label} didn't accept your key. Open Providers and paste it again.`
  if (res.status === 402) return `${label} says your account needs credit.`
  if (res.status === 404) return `${label} doesn't know that model name. Check the spelling in Providers.`
  if (res.status === 429) return `${label} says too many requests, or you have used up its free or paid limit. Wait a while, pick another model, or switch to a model on this computer.`
  try {
    const j = (await res.json()) as { error?: { message?: string } | string }
    const m = typeof j.error === 'string' ? j.error : j.error?.message
    if (m) return `${label}: ${m}`
  } catch {
    /* fall through */
  }
  return `${label} returned an error (${res.status}).`
}

export async function streamProvider(opts: {
  providerId: string
  model: string
  messages: ChatMessage[]
  system: string
  signal: AbortSignal
  onToken: (text: string) => void
  onDone: (info: { tokens?: number; promptTokens?: number }) => void
}): Promise<void> {
  const p = readList().find((x) => x.id === opts.providerId)
  const key = p ? readKey(p.id) : null
  if (!p || !key) throw new Error('Add this provider and its key first. Open Providers in the sidebar.')
  const turns = opts.messages.filter((m) => m.role !== 'system')
  let tokens: number | undefined
  let promptTokens: number | undefined

  if (p.kind === 'anthropic') {
    const res = await fetch(`${p.baseUrl}/v1/messages`, {
      method: 'POST',
      redirect: 'error', // never follow a redirect with the key attached
      signal: opts.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 8192,
        stream: true,
        system: opts.system,
        messages: turns.map((m) => ({
          role: m.role,
          content: m.images?.length
            ? [
                ...m.images.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })),
                { type: 'text', text: m.content }
              ]
            : m.content
        }))
      })
    })
    if (!res.ok) throw new Error(await apiError(res, p.label))
    for await (const raw of readLines(res)) {
      if (!raw.startsWith('data:')) continue
      let obj: any // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        obj = JSON.parse(raw.slice(5).trim())
      } catch {
        continue
      }
      if (obj.type === 'error') throw new Error(`${p.label}: ${obj.error?.message ?? 'the model stopped with an error.'}`)
      if (obj.type === 'content_block_delta' && typeof obj.delta?.text === 'string') opts.onToken(obj.delta.text)
      if (obj.type === 'message_start') promptTokens = obj.message?.usage?.input_tokens
      if (obj.type === 'message_delta') tokens = obj.usage?.output_tokens
    }
    opts.onDone({ tokens, promptTokens })
    return
  }

  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    redirect: 'error', // never follow a redirect with the key attached
    method: 'POST',
    signal: opts.signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: opts.system },
        ...turns.map((m) =>
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
    })
  })
  if (!res.ok) throw new Error(await apiError(res, p.label))
  for await (const raw of readLines(res)) {
    const line = raw.trim()
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') break
    let obj: any // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      obj = JSON.parse(data)
    } catch {
      continue
    }
    if (obj.error) throw new Error(`${p.label}: ${obj.error.message ?? 'the model stopped with an error.'}`)
    const piece = obj.choices?.[0]?.delta?.content
    if (typeof piece === 'string' && piece) opts.onToken(piece)
    if (obj.usage) {
      tokens = obj.usage.completion_tokens
      promptTokens = obj.usage.prompt_tokens
    }
  }
  opts.onDone({ tokens, promptTokens })
}
