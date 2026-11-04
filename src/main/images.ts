// Make an image: Cloudflare Workers AI (FLUX schnell) with the user's own free Cloudflare account.
// The account id and token are encrypted with the operating system's protection and stay in the main process.
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { promises as fs } from 'fs'
import { join, posix } from 'path'
import { resolveInside } from './fsGuard'

const MODEL = '@cf/black-forest-labs/flux-1-schnell'
// Where the encrypted key lives and how it is protected. Tests swap this for a plain in-memory version,
// so they do not need Electron.
export type ImageStore = {
  dir: () => string
  available: () => boolean
  encrypt: (s: string) => Buffer
  decrypt: (b: Buffer) => string
}
let store: ImageStore = {
  dir: () => app.getPath('userData'),
  available: () => safeStorage.isEncryptionAvailable(),
  encrypt: (s) => safeStorage.encryptString(s),
  decrypt: (b) => safeStorage.decryptString(b)
}
export function useImageStore(s: ImageStore): void {
  store = s
}
const keyFile = (): string => join(store.dir(), 'cloudflare-image.key')

type Creds = { account: string; token: string }

function readCreds(): Creds | null {
  try {
    if (!existsSync(keyFile()) || !store.available()) return null
    const c = JSON.parse(store.decrypt(Buffer.from(readFileSync(keyFile(), 'utf8'), 'base64')))
    return typeof c.account === 'string' && typeof c.token === 'string' ? c : null
  } catch {
    return null
  }
}

export const imageReady = (): boolean => readCreds() !== null

export function checkCreds(account: unknown, token: unknown): Creds {
  if (typeof account !== 'string' || !/^[a-f0-9]{32}$/i.test(account.trim())) {
    throw new Error("The Account ID should be 32 letters and numbers. Copy it from the Cloudflare dashboard.")
  }
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(token.trim())) {
    throw new Error("That doesn't look like a Cloudflare API token.")
  }
  return { account: account.trim(), token: token.trim() }
}

export function setImageKey(account: unknown, token: unknown): void {
  const c = checkCreds(account, token)
  if (!store.available()) throw new Error("This computer can't protect the key safely, so Setu won't save it.")
  writeFileSync(keyFile(), store.encrypt(JSON.stringify(c)).toString('base64'), { mode: 0o600 })
}

export function clearImageKey(): void {
  try {
    unlinkSync(keyFile())
  } catch {
    /* already gone */
  }
}

export function cleanImagePrompt(p: unknown): string {
  const t = typeof p === 'string' ? p.replace(/\s+/g, ' ').trim() : ''
  if (!t) throw new Error('Describe the picture you want.')
  return t.slice(0, 1500)
}

/** Makes one picture and saves it in the project's images folder. Returns the saved path and a preview. */
export async function makeImage(root: string | null, promptIn: unknown): Promise<{ path: string | null; dataUrl: string }> {
  const prompt = cleanImagePrompt(promptIn)
  const c = readCreds()
  if (!c) throw new Error('Add your Cloudflare details first.')
  let res: Response
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.account}/ai/run/${MODEL}`, {
    redirect: 'error', // never follow a redirect with the key attached
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(90_000)
    })
  } catch {
    throw new Error("Couldn't reach Cloudflare. Check your internet and try again.")
  }
  if (res.status === 401 || res.status === 403) throw new Error('Cloudflare did not accept the token. Check that it can use Workers AI.')
  if (res.status === 429) throw new Error("You've used today's free images. It resets at 05:30 AM India time.")
  let body: { success?: boolean; result?: { image?: string }; errors?: Array<{ message?: string }> } = {}
  try {
    body = await res.json()
  } catch {
    /* handled below */
  }
  const b64 = body.result?.image
  if (!res.ok || !b64) throw new Error(body.errors?.[0]?.message ? `Cloudflare said: ${body.errors[0].message}` : 'Cloudflare could not make that image. Try different words.')
  const buf = Buffer.from(b64, 'base64')
  const dataUrl = `data:image/jpeg;base64,${b64}`
  if (!root) return { path: null, dataUrl }
  const rel = posix.join('images', `setu-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.jpg`)
  const abs = await resolveInside(root, rel)
  await fs.mkdir(join(root, 'images'), { recursive: true })
  await fs.writeFile(abs, buf)
  return { path: rel, dataUrl }
}
