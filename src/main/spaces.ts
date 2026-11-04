// The list of project folders the user has chosen. Only folders picked in the folder dialog are ever added.
import { promises as fs } from 'fs'
import * as path from 'path'

export type SpacesState = { spaces: { path: string; name: string }[]; active: string | null }
type Stored = { paths: string[]; active: string | null }

const same = (a: string, b: string): boolean =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b

async function load(file: string): Promise<Stored> {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'))
    const paths = Array.isArray(data.paths) ? data.paths.filter((p: unknown) => typeof p === 'string') : []
    return { paths, active: typeof data.active === 'string' ? data.active : null }
  } catch {
    return { paths: [], active: null }
  }
}

async function save(file: string, s: Stored): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(s), 'utf8')
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory()
  } catch {
    return false
  }
}

export async function getState(file: string): Promise<SpacesState> {
  const s = await load(file)
  const alive: string[] = []
  for (const p of s.paths) if (await isDir(p)) alive.push(p)
  const active = s.active && alive.some((p) => same(p, s.active as string)) ? s.active : null
  return { spaces: alive.map((p) => ({ path: p, name: path.basename(p) || p })), active }
}

export async function addSpace(file: string, folder: string): Promise<SpacesState> {
  const p = path.resolve(folder)
  if (!(await isDir(p))) throw new Error('That folder does not exist.')
  const s = await load(file)
  if (!s.paths.some((x) => same(x, p))) s.paths.push(p)
  s.active = p
  await save(file, s)
  return getState(file)
}

export async function selectSpace(file: string, folder: string): Promise<SpacesState> {
  const s = await load(file)
  const match = s.paths.find((x) => same(x, folder))
  if (!match) throw new Error('Unknown project folder.')
  s.active = match
  await save(file, s)
  return getState(file)
}

export async function removeSpace(file: string, folder: string): Promise<SpacesState> {
  const s = await load(file)
  s.paths = s.paths.filter((x) => !same(x, folder))
  if (s.active && same(s.active, folder)) s.active = null
  await save(file, s)
  return getState(file)
}
