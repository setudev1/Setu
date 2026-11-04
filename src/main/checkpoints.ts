// Applying changes safely: every batch is snapshotted first, so it can be undone.
import { promises as fs } from 'fs'
import * as path from 'path'
import { MAX_FILE_CHARS, cleanRelPath, resolveInside } from './fsGuard'

export type Change = { path: string; content: string }
export type CheckpointInfo = {
  id: string
  label: string
  createdAt: string
  files: { path: string; existed: boolean }[]
}

const ID_RE = /^[A-Za-z0-9-]+$/

async function pruneEmptyDirs(root: string, startDir: string): Promise<void> {
  let dir = startDir
  const realRoot = path.resolve(root)
  while (path.resolve(dir) !== realRoot && path.resolve(dir).startsWith(realRoot)) {
    try {
      await fs.rmdir(dir)
    } catch {
      return
    }
    dir = path.dirname(dir)
  }
}

/** Saves the current state of the given files (or the fact that they don't exist yet). */
export async function createCheckpoint(
  root: string,
  storeDir: string,
  label: string,
  relPaths: string[]
): Promise<CheckpointInfo> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const dir = path.join(storeDir, id)
  await fs.mkdir(path.join(dir, 'files'), { recursive: true })
  const files: CheckpointInfo['files'] = []
  for (let i = 0; i < relPaths.length; i++) {
    const rel = cleanRelPath(relPaths[i])
    const abs = await resolveInside(root, rel)
    let existed = false
    try {
      const st = await fs.stat(abs)
      if (st.isFile()) {
        existed = true
        await fs.copyFile(abs, path.join(dir, 'files', `${i}.bak`))
      }
    } catch {
      existed = false
    }
    files.push({ path: rel, existed })
  }
  const info: CheckpointInfo = { id, label, createdAt: new Date().toISOString(), files }
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(info), 'utf8')
  return info
}

async function restoreFiles(root: string, storeDir: string, info: CheckpointInfo): Promise<void> {
  const dir = path.join(storeDir, info.id)
  for (let i = 0; i < info.files.length; i++) {
    const f = info.files[i]
    const abs = await resolveInside(root, f.path)
    if (f.existed) {
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.copyFile(path.join(dir, 'files', `${i}.bak`), abs)
    } else {
      await fs.rm(abs, { force: true })
      await pruneEmptyDirs(root, path.dirname(abs))
    }
  }
}

export async function applyChanges(
  root: string,
  storeDir: string,
  label: string,
  changes: Change[]
): Promise<{ checkpointId: string; written: string[] }> {
  if (!Array.isArray(changes) || changes.length === 0) throw new Error('No changes to apply.')
  if (changes.length > 50) throw new Error('Too many files in one change (limit 50).')

  const byPath = new Map<string, { rel: string; abs: string; content: string }>()
  for (const c of changes) {
    const rel = cleanRelPath(c?.path)
    if (typeof c.content !== 'string' || c.content.length > MAX_FILE_CHARS) {
      throw new Error(`Content for ${rel} is missing or too large.`)
    }
    const abs = await resolveInside(root, rel)
    let existing: string | null = null
    try {
      const st = await fs.stat(abs)
      if (st.isDirectory()) throw new Error(`${rel} is a folder, not a file.`)
      existing = await fs.readFile(abs, 'utf8')
    } catch (e) {
      if ((e as { code?: string }).code !== 'ENOENT') throw e
    }
    let content = c.content.endsWith('\n') ? c.content : c.content + '\n'
    // Keep the file's existing line-ending style so version control doesn't see every line as changed.
    if (existing && existing.includes('\r\n') && !content.includes('\r\n')) {
      content = content.replace(/\n/g, '\r\n')
    }
    byPath.set(rel.toLowerCase(), { rel, abs, content })
  }
  const prepared = [...byPath.values()]

  const info = await createCheckpoint(root, storeDir, label, prepared.map((p) => p.rel))
  try {
    for (const p of prepared) {
      await fs.mkdir(path.dirname(p.abs), { recursive: true })
      await fs.writeFile(p.abs, p.content, 'utf8')
    }
  } catch (e) {
    await restoreFiles(root, storeDir, info).catch(() => undefined)
    throw new Error(`Could not write the files (${(e as Error).message}). Everything was put back as it was.`)
  }
  return { checkpointId: info.id, written: prepared.map((p) => p.rel) }
}

export async function listCheckpoints(storeDir: string): Promise<CheckpointInfo[]> {
  let names: string[]
  try {
    names = await fs.readdir(storeDir)
  } catch {
    return []
  }
  const out: CheckpointInfo[] = []
  for (const n of names) {
    if (!ID_RE.test(n)) continue
    try {
      out.push(JSON.parse(await fs.readFile(path.join(storeDir, n, 'manifest.json'), 'utf8')))
    } catch {
      /* skip broken entries */
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return out.slice(0, 100)
}

/** Puts files back as they were. The state just before restoring is saved too, so a restore can itself be undone. */
export async function restoreCheckpoint(
  root: string,
  storeDir: string,
  id: string
): Promise<{ restored: string[]; undoCheckpointId: string }> {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Invalid checkpoint.')
  let info: CheckpointInfo
  try {
    info = JSON.parse(await fs.readFile(path.join(storeDir, id, 'manifest.json'), 'utf8'))
  } catch {
    throw new Error('That checkpoint no longer exists.')
  }
  const undo = await createCheckpoint(
    root,
    storeDir,
    `Before restoring: ${info.label}`,
    info.files.map((f) => f.path)
  )
  await restoreFiles(root, storeDir, info)
  return { restored: info.files.map((f) => f.path), undoCheckpointId: undo.id }
}
