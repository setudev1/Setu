// Reading the project folder: file list, file contents, and the context sent to the model.
import { promises as fs } from 'fs'
import * as path from 'path'
import { BLOCKED_DIRS, MAX_FILE_CHARS, resolveInside } from './fsGuard'

const SKIP_DIRS = new Set(['dist', 'out', '__pycache__', '.venv', 'venv', '.idea', '.next', 'coverage'])
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])
const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt',
  '.py', '.java', '.c', '.h', '.cpp', '.cs', '.go', '.rs', '.php', '.rb', '.sh', '.yml', '.yaml',
  '.toml', '.xml', '.sql', '.vue', '.svelte'
])
const MAX_FILES = 1000
const MAX_DEPTH = 8

export type FileRead =
  | { exists: false }
  | { exists: true; binary: true }
  | { exists: true; binary: false; content: string }


const DESIGN_RULES =
  '\nWhen you build a website or web page, make it look professional, not like a plain tutorial page:\n' +
  '- Use separate files: index.html, css/style.css, js/script.js (link them with relative paths). Never put a big style block inside the HTML.\n' +
  '- In CSS start with :root variables for colors, fonts and spacing, a small reset (box-sizing, margin 0), and a system font stack or one Google Font.\n' +
  '- Pick a clear palette of 3 colors plus neutrals, with enough contrast. Use generous spacing, rounded corners, soft shadows and a readable type scale (h1 2.5rem, body 1rem, line-height 1.6).\n' +
  '- Layout with flexbox or grid. It MUST be responsive: a mobile-first layout and a media query for wider screens, and <meta name="viewport"> in the head.\n' +
  '- Use semantic HTML (header, nav, main, section, footer), a sticky or clear navigation, a strong hero section, cards, buttons with hover and focus states, and smooth transitions.\n' +
  '- Write real, specific text for the topic. Never use lorem ipsum. Add alt text to images and use gradients or inline SVG instead of broken image links.\n' +
  '- Add small touches of JavaScript only when useful (menu toggle, form check, smooth scroll). Keep the code tidy and commented briefly.\n'

export const PROJECT_PROMPT =
  "You are working inside the user's project folder. The user's files are listed below.\n" +
  'IMPORTANT: Never just paste code for the user to copy. Setu saves files for the user, so every file you make or change MUST be written in this exact format:\n' +
  'FILE: relative/path.ext\n' +
  '```\n' +
  '(the COMPLETE content of that file)\n' +
  '```\n' +
  'Example for a new page:\n' +
  'FILE: index.html\n' +
  '```html\n' +
  '<!doctype html>\n' +
  '<html><body><h1>Hello</h1></body></html>\n' +
  '```\n' +
  'Rules: the line FILE: comes first, alone on its own line, right before the code block. One file per code block. ' +
  'Always give the whole file, never a partial snippet. ' +
  'If a file with that name is already in the project, use the same path so the user sees what changed. ' +
  "Use relative paths only (no absolute paths, no '..'). " +
  'Only write FILE: lines for files you are creating or changing. ' +
  'Explain briefly in plain text outside the code blocks. ' +
  'The user must approve changes before they are saved, so never say a file has already been saved.' +
  DESIGN_RULES

export const NO_FOLDER_PROMPT =
  'When you write code for the user, never just paste it. Write every file in this exact format so Setu can save it:\n' +
  'FILE: relative/path.ext\n' +
  '```\n' +
  '(the COMPLETE content of that file)\n' +
  '```\n' +
  'One file per code block, whole file every time, relative paths only (folders are fine, like src/app.js). ' +
  'Tell the user briefly in plain text outside the code blocks, and never say a file has already been saved.' +
  DESIGN_RULES

export async function listFiles(root: string): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = []
  let truncated = false
  async function walk(dir: string, rel: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || truncated) return
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null)
    if (!entries) return
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (truncated) return
      if (e.isSymbolicLink()) continue
      const name = e.name
      const childRel = rel ? `${rel}/${name}` : name
      if (e.isDirectory()) {
        if (BLOCKED_DIRS.has(name.toLowerCase()) || SKIP_DIRS.has(name.toLowerCase())) continue
        await walk(path.join(dir, name), childRel, depth + 1)
      } else if (e.isFile()) {
        if (files.length >= MAX_FILES) {
          truncated = true
          return
        }
        files.push(childRel)
      }
    }
  }
  await walk(root, '', 0)
  return { files, truncated }
}

export async function readText(root: string, rel: string): Promise<FileRead> {
  const abs = await resolveInside(root, rel)
  let st
  try {
    st = await fs.stat(abs)
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return { exists: false }
    throw e
  }
  if (st.isDirectory()) throw new Error('That path is a folder.')
  if (st.size > MAX_FILE_CHARS) return { exists: true, binary: true }
  const buf = await fs.readFile(abs)
  if (buf.subarray(0, 8000).includes(0)) return { exists: true, binary: true }
  return { exists: true, binary: false, content: buf.toString('utf8') }
}

/** The file list plus the contents of small text files, kept short because small models have small memory. */
export async function buildContext(root: string, budget = 12000, focus: string[] = []): Promise<string> {
  const { files, truncated } = await listFiles(root)
  if (files.length === 0) return 'The project folder is empty.'
  const shown = files.slice(0, 200)
  let out = 'Project files:\n' + shown.map((f) => `- ${f}`).join('\n')
  if (files.length > shown.length || truncated) out += '\n- ... (more files not shown)'

  const candidates: { rel: string; size: number }[] = []
  for (const rel of files) {
    const base = rel.split('/').pop() as string
    if (SKIP_FILES.has(base)) continue
    if (!TEXT_EXT.has(path.extname(base).toLowerCase())) continue
    try {
      const st = await fs.stat(path.join(root, ...rel.split('/')))
      if (st.size <= 60_000) candidates.push({ rel, size: st.size })
    } catch {
      /* skip */
    }
  }
  candidates.sort((a, b) => a.size - b.size)

  let used = out.length
  const parts: string[] = []
  // Files the user pointed at with @ go first and get more room, because they are what the question is about.
  const focusSet = new Set<string>()
  for (const rel of focus.slice(0, 3)) {
    if (!files.includes(rel)) continue
    const r = await readText(root, rel).catch(() => null)
    if (!r || !r.exists || r.binary) continue
    const text = r.content.length > 20000 ? r.content.slice(0, 20000) + '\n[... file truncated ...]' : r.content
    parts.push(`--- ${rel} (the user pointed at this file) ---\n${text}\n--- end of ${rel} ---`)
    used += text.length + 80
    focusSet.add(rel)
  }
  for (const c of candidates) {
    if (focusSet.has(c.rel)) continue
    const r = await readText(root, c.rel).catch(() => null)
    if (!r || !r.exists || r.binary) continue
    let text = r.content
    if (text.length > 6000) text = text.slice(0, 6000) + '\n[... file truncated ...]'
    const block = `--- ${c.rel} ---\n${text}\n--- end of ${c.rel} ---`
    if (used + block.length > budget) continue
    parts.push(block)
    used += block.length
  }
  if (parts.length) out += '\n\nContents of files:\n' + parts.join('\n')
  return out
}

export type SearchHit = { path: string; line: number; text: string }

/** Finds text in the project's text files. Plain text match, not case sensitive. */
export async function searchProject(root: string, query: string): Promise<{ hits: SearchHit[]; truncated: boolean }> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return { hits: [], truncated: false }
  const { files } = await listFiles(root)
  const hits: SearchHit[] = []
  let truncated = false
  for (const rel of files) {
    if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) continue
    const r = await readText(root, rel).catch(() => null)
    if (!r || !r.exists || r.binary) continue
    const lines = r.content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        if (hits.length >= 100) {
          truncated = true
          return { hits, truncated }
        }
        hits.push({ path: rel, line: i + 1, text: lines[i].trim().slice(0, 200) })
      }
    }
  }
  return { hits, truncated }
}

export const RULES_FILE = 'SETU.md'

/** The project's own rules, written by the user in SETU.md. Short on purpose. */
export async function readRules(root: string): Promise<string | null> {
  const r = await readText(root, RULES_FILE).catch(() => null)
  if (!r || !r.exists || r.binary) return null
  const t = r.content.trim()
  return t ? t.slice(0, 4000) : null
}

export const NOTES_MAX = 4000

/** Cut notes to the size Setu reads. Keeps the newest end, because new notes are added at the bottom. */
export function trimNotes(t: string): string {
  const x = t.replace(/\r\n/g, '\n').trim()
  return x.length > NOTES_MAX ? x.slice(x.length - NOTES_MAX) : x
}
