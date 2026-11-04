// The user's wallpaper: one image, GIF or video chosen from their computer, copied into Setu's own data folder.
import { promises as fs } from 'fs'
import * as path from 'path'

export const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])
export const VIDEO_EXT = new Set(['.mp4', '.webm'])
export const MAX_BYTES = 300 * 1024 * 1024

export type WallpaperState = {
  kind: 'image' | 'video' | null
  dim: number
  blur: number
  version: number
  url: string | null
}
type Stored = { file: string | null; kind: 'image' | 'video' | null; dim: number; blur: number; version: number }

const DEFAULT: Stored = { file: null, kind: null, dim: 0.55, blur: 0, version: 0 }
const settingsPath = (dir: string): string => path.join(dir, 'wallpaper.json')

export const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

async function load(dir: string): Promise<Stored> {
  try {
    const d = JSON.parse(await fs.readFile(settingsPath(dir), 'utf8'))
    const kind = d.kind === 'image' || d.kind === 'video' ? d.kind : null
    const file = typeof d.file === 'string' && /^[A-Za-z0-9._-]+$/.test(d.file) && kind ? d.file : null
    return {
      file,
      kind: file ? kind : null,
      dim: clamp(d.dim, 0, 0.9, DEFAULT.dim),
      blur: clamp(d.blur, 0, 20, DEFAULT.blur),
      version: clamp(d.version, 0, Number.MAX_SAFE_INTEGER, 0)
    }
  } catch {
    return { ...DEFAULT }
  }
}

async function save(dir: string, s: Stored): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(settingsPath(dir), JSON.stringify(s), 'utf8')
}

const toState = (s: Stored): WallpaperState => ({
  kind: s.file ? s.kind : null,
  dim: s.dim,
  blur: s.blur,
  version: s.version,
  url: s.file ? `setu-media://wallpaper/current?v=${s.version}` : null
})

/** The wallpaper file on disk, or null. This is the only file the media protocol is allowed to serve. */
export async function getWallpaperFile(dir: string): Promise<string | null> {
  const s = await load(dir)
  if (!s.file) return null
  const p = path.join(dir, s.file)
  try {
    return (await fs.stat(p)).isFile() ? p : null
  } catch {
    return null
  }
}

export async function getWallpaper(dir: string): Promise<WallpaperState> {
  const s = await load(dir)
  if (s.file && !(await getWallpaperFile(dir))) return toState({ ...s, file: null, kind: null })
  return toState(s)
}

export async function setWallpaper(dir: string, source: string): Promise<WallpaperState> {
  const ext = path.extname(source).toLowerCase()
  const kind = IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : null
  if (!kind) throw new Error('Choose an image (png, jpg, webp, gif, avif) or a video (mp4, webm).')
  let st
  try {
    st = await fs.stat(source)
  } catch {
    throw new Error('That file could not be found.')
  }
  if (!st.isFile()) throw new Error('Choose a file, not a folder.')
  if (st.size > MAX_BYTES) throw new Error('That file is too large (limit 300 MB).')

  const old = await load(dir)
  const version = Date.now()
  const name = `wallpaper-${version}${ext}`
  await fs.mkdir(dir, { recursive: true })
  await fs.copyFile(source, path.join(dir, name))
  await save(dir, { ...old, file: name, kind, version })
  if (old.file && old.file !== name) await fs.rm(path.join(dir, old.file), { force: true })
  return getWallpaper(dir)
}

export async function clearWallpaper(dir: string): Promise<WallpaperState> {
  const old = await load(dir)
  await save(dir, { ...old, file: null, kind: null })
  if (old.file) await fs.rm(path.join(dir, old.file), { force: true })
  return getWallpaper(dir)
}

export async function setLook(dir: string, look: { dim?: unknown; blur?: unknown }): Promise<WallpaperState> {
  const s = await load(dir)
  s.dim = clamp(look?.dim, 0, 0.9, s.dim)
  s.blur = clamp(look?.blur, 0, 20, s.blur)
  await save(dir, s)
  return getWallpaper(dir)
}
