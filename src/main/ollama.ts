// Talks to Ollama running on this computer. Nothing here ever leaves the machine.
export const OLLAMA_URL = process.env.SETU_OLLAMA_URL || 'http://127.0.0.1:11434'

const MODEL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }
export type OllamaModel = { name: string; size: number; modified: string }

export const SYSTEM_PROMPT =
  'You are Setu, a local-first AI coding assistant. Be concise and practical. ' +
  'When you write code, put it in fenced code blocks with the language name. ' +
  'If you are not sure about something, say so instead of guessing.'

export const SCREENSHOT_PROMPT =
  'The user attached one or more screenshots, usually of an error or of something that looks wrong. ' +
  'Read the text in the picture, say in plain words what is going wrong, then give the fix. ' +
  'If you cannot read the picture, say so and ask for the error text instead of guessing.'

export function isValidModelName(name: unknown): name is string {
  return typeof name === 'string' && MODEL_NAME_RE.test(name)
}

export function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: string } }).cause
    if (err.message === 'fetch failed' || cause?.code === 'ECONNREFUSED') {
      return "Can't reach Ollama. Make sure Ollama is running, then try again."
    }
    return err.message
  }
  return 'Something went wrong.'
}

/** Turns Ollama Cloud errors (not signed in, limit reached) into plain steps. */
export function cloudHint(message: string, status?: number): string {
  const m = message.toLowerCase()
  if (status === 401 || m.includes('unauthorized') || m.includes('not signed in') || m.includes('sign in') || m.includes('signin')) {
    return 'Sign in to Ollama first: open the Ollama app, sign in, then try again.'
  }
  if (status === 429 || m.includes('usage limit') || m.includes('rate limit') || m.includes('too many requests') || m.includes('quota')) {
    return "Ollama's cloud limit was reached. Wait a while, add credits at ollama.com, or switch to a model on this computer."
  }
  if (status === 402 || m.includes('credits') || m.includes('subscription') || m.includes('upgrade')) {
    return 'This cloud model needs credits or a paid Ollama plan. Add credits at ollama.com, or pick a smaller cloud or local model.'
  }
  return message
}

async function errorText(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return cloudHint(data.error, res.status)
  } catch {
    /* ignore */
  }
  return cloudHint(`Ollama returned an error (${res.status}).`, res.status)
}

// Ollama streams one JSON object per line. This turns the byte stream into whole lines.
export async function* readLines(res: Response): AsyncGenerator<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = (res.body as any).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) yield line
    }
  }
  const rest = buffer.trim()
  if (rest) yield rest
}

/** Reads one line of Ollama's stream. A broken line (an old Ollama, or another program on the same port) gets a clear message. */
export function parseLine(line: string): any {
  try {
    return JSON.parse(line)
  } catch {
    throw new Error("Ollama sent an answer Setu could not read. Update Ollama to the newest version, make sure nothing else uses port 11434, then try again.")
  }
}

export async function getStatus(): Promise<{ running: boolean; version?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return { running: false }
    const data = (await res.json()) as { version?: string }
    return { running: true, version: data.version }
  } catch {
    return { running: false }
  }
}

// Models that can read pictures. Ollama reports this in /api/show; the name list is a fallback.
export const VISION_NAME_RE = /(llava|vision|[-:.]vl\b|vl[-:]|gemma3(?![:-]1b)|minicpm-v|moondream|bakllava|llama4)/i

export async function supportsVision(model: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(4000)
    })
    if (res.ok) {
      const data = (await res.json()) as { capabilities?: string[] }
      if (Array.isArray(data.capabilities)) return data.capabilities.includes('vision')
    }
  } catch {
    /* fall through to the name check */
  }
  return VISION_NAME_RE.test(model)
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`)
  if (!res.ok) throw new Error(await errorText(res))
  const data = (await res.json()) as {
    models?: { name: string; size?: number; modified_at?: string }[]
  }
  return (data.models ?? []).map((m) => ({
    name: m.name,
    size: m.size ?? 0,
    modified: m.modified_at ?? ''
  }))
}

export const KEEP_ALIVE = '30m'

/** Loads a model into memory ahead of the first message. Uses the same memory window as real chats, or Ollama would reload it. */
export async function warmModel(model: string, numCtx = 8192): Promise<void> {
  try {
    await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [], stream: false, keep_alive: KEEP_ALIVE, options: { num_ctx: numCtx } }),
      signal: AbortSignal.timeout(120000)
    })
  } catch {
    /* warming is only a speed-up; ignore failures */
  }
}

export async function streamChat(opts: {
  model: string
  messages: ChatMessage[]
  signal: AbortSignal
  system?: string
  numCtx?: number
  onToken: (text: string) => void
  onDone: (info: { tokens?: number; promptTokens?: number }) => void
}): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      // Ollama's default memory window is small; this keeps the project files from being cut off.
      options: { num_ctx: opts.numCtx ?? 8192 },
      // Keep the model in memory between messages, so the next answer starts at once instead of reloading.
      keep_alive: KEEP_ALIVE,
      messages: [
        { role: 'system', content: opts.system ? `${SYSTEM_PROMPT}\n\n${opts.system}` : SYSTEM_PROMPT },
        ...opts.messages.filter((m) => m.role !== 'system')
      ]
    })
  })
  if (!res.ok) throw new Error(await errorText(res))

  let tokens: number | undefined
  let promptTokens: number | undefined
  for await (const line of readLines(res)) {
    const obj = parseLine(line)
    if (obj.error) throw new Error(obj.error)
    const piece = obj.message?.content
    if (piece) opts.onToken(piece)
    if (obj.done) {
      tokens = obj.eval_count
      promptTokens = obj.prompt_eval_count
    }
  }
  opts.onDone({ tokens, promptTokens })
}

export async function pullModel(opts: {
  name: string
  signal: AbortSignal
  onProgress: (p: { status: string; total?: number; completed?: number }) => void
}): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({ model: opts.name, stream: true })
  })
  if (!res.ok) throw new Error(await errorText(res))
  for await (const line of readLines(res)) {
    const obj = parseLine(line)
    if (obj.error) throw new Error(obj.error)
    opts.onProgress({ status: obj.status ?? '', total: obj.total, completed: obj.completed })
  }
}
