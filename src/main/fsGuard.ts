// Safety rules for touching the user's files. Every read and write goes through here.
import { promises as fs } from 'fs'
import * as path from 'path'

export const BLOCKED_DIRS = new Set(['.git', '.setu', 'node_modules'])
export const MAX_FILE_CHARS = 1_000_000

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Turns a model-supplied path into a clean relative path like "src/app.js", or throws. */
export function cleanRelPath(rel: unknown): string {
  if (typeof rel !== 'string') throw new Error('Invalid file path.')
  const raw = rel.trim()
  if (!raw || raw.length > 260) throw new Error('Invalid file path.')
  if (raw.includes('\0') || raw.includes(':') || raw.startsWith('/') || raw.startsWith('\\')) {
    throw new Error(`Not allowed: ${raw}`)
  }
  const segments = raw.split(/[\\/]+/).filter((s) => s && s !== '.')
  if (segments.length === 0) throw new Error('Invalid file path.')
  for (const s of segments) {
    if (
      s === '..' ||
      BLOCKED_DIRS.has(s.toLowerCase()) ||
      /[<>"|?*]/.test(s) ||
      /[. ]$/.test(s) ||
      WINDOWS_RESERVED.test(s)
    ) {
      throw new Error(`Not allowed: ${raw}`)
    }
  }
  return segments.join('/')
}

function isInside(realRoot: string, real: string): boolean {
  const r = path.relative(realRoot, real)
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r))
}

/** Absolute path for a project-relative path, guaranteed to stay inside the project (symlinks included). */
export async function resolveInside(root: string, rel: string): Promise<string> {
  const clean = cleanRelPath(rel)
  const abs = path.join(root, ...clean.split('/'))
  const realRoot = await fs.realpath(root)
  let probe = abs
  for (;;) {
    try {
      const real = await fs.realpath(probe)
      if (!isInside(realRoot, real)) throw new Error(`Not allowed: ${rel}`)
      return abs
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'ENOENT') {
        if ((e as Error).message.startsWith('Not allowed')) throw e
        throw new Error(`Cannot use this path: ${rel}`)
      }
      const parent = path.dirname(probe)
      if (parent === probe) throw new Error(`Not allowed: ${rel}`)
      probe = parent
    }
  }
}
