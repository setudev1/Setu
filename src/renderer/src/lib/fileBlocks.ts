// Finds file changes in a model reply. These become proposed file changes (the diff and Allow buttons).
// Best format: a "FILE: path" line, then a code block. Small models often label files in other ways, so
// we also understand: a name in the code fence ("```html index.html"), a name on the line just before
// the block ("**index.html**", "### style.css", "Create a file named app.py:"), or a name in a comment on
// the first line of the block ("// script.js", "<!-- index.html -->").
export type FileBlock = { path: string; content: string; complete: boolean }

const FILE_LINE = /^\s*[`#>*_\-\s]*file\s*[:：]\s*[`'"*]*([^\s`'"*]+)[`'"*\s]*(?:\(.*\))?[`'"*\s]*$/i
const FENCE_OPEN = /^\s*```(.*)$/
const FENCE_CLOSE = /^\s*```\s*$/
const PATH = '([\\w][\\w.\\-\\/]*\\.[A-Za-z][A-Za-z0-9]{0,7})'
// A line that only introduces a file, e.g. "**index.html**", "### style.css:", "Create a file named app.py:"
const HINT_LINE = new RegExp(
  '^(?:(?:here(?:\'s| is)|this is|now|next|create|creating|update|updated|edit|save|add|new|modify|the|a|an|code|for|in|file|named|called|your)\\s+)*' +
    PATH + '\\s*(?:\\(.*\\))?\\s*[:：]?\\s*$',
  'i'
)
const FIRST_LINE_COMMENT = new RegExp(
  '^\\s*(?:\\/\\/|#|--|\\/\\*|<!--)\\s*(?:file(?:name)?\\s*[:：]\\s*)?' + PATH + '\\s*(?:\\*\\/|-->)?\\s*$',
  'i'
)
const INFO_PATH = new RegExp('(?:^|[\\s:=,{(\\[])["\']?' + PATH + '["\']?(?=$|[\\s,})\\]])', 'i')

function safe(p: string): string | null {
  const q = p.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!q || q.startsWith('/') || q.startsWith('~') || /^[A-Za-z]:/.test(q) || q.split('/').includes('..')) return null
  if (/^(?:e\.g|i\.e|etc|www)\./i.test(q) || /^https?:/i.test(q)) return null
  return q
}

function hintFrom(line: string): string | null {
  const t = line.trim()
  if (!t || t.length > 120) return null
  const cleaned = t.replace(/[`*_#>]+/g, ' ').replace(/^[\-\d.)\s]+/, '').replace(/\s+/g, ' ').trim()
  const m = HINT_LINE.exec(cleaned)
  return m ? safe(m[1]) : null
}

export function parseFileBlocks(text: string): FileBlock[] {
  const lines = text.split(/\r?\n/)
  const found: FileBlock[] = []
  let pending: string | null = null // from a "FILE:" line (strongest)
  let hint: string | null = null // from a line like "**index.html**"
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const open = FENCE_OPEN.exec(line)
    if (open) {
      const info = (open[1] || '').trim()
      const start = i + 1
      let j = start
      while (j < lines.length && !FENCE_CLOSE.test(lines[j])) j++
      const complete = j < lines.length
      let body = lines.slice(start, j)
      let path: string | null = pending
      if (!path && info) {
        const m = INFO_PATH.exec(info)
        if (m) path = safe(m[1])
      }
      if (!path && hint) path = hint
      if (!path && body.length > 1) {
        const m = FIRST_LINE_COMMENT.exec(body[0])
        if (m) {
          path = safe(m[1])
          if (path) body = body.slice(1)
        }
      }
      if (path) found.push({ path, content: body.join('\n'), complete })
      pending = null
      hint = null
      i = complete ? j + 1 : lines.length
      continue
    }
    const m = FILE_LINE.exec(line)
    if (m) {
      pending = m[1]
      hint = null
    } else if (line.trim() !== '') {
      pending = null
      hint = hintFrom(line)
    }
    i++
  }
  // If the same file appears twice, the last version wins.
  const byPath = new Map<string, FileBlock>()
  for (const b of found) byPath.set(b.path.replace(/\\/g, '/').toLowerCase(), b)
  return [...byPath.values()]
}

// Code blocks the model wrote WITHOUT saying which file they belong to. We never save these by guessing:
// the user picks a file name first (see LooseCodeSaver), then the normal diff + Save flow runs.
export type LooseBlock = { lang: string; content: string; suggested: string }
const SKIP_LANGS = new Set(['bash', 'sh', 'shell', 'cmd', 'powershell', 'ps1', 'console', 'terminal', 'text', 'txt', 'output', 'log', 'diff'])
const NAME_FOR: Record<string, string> = {
  html: 'index.html', htm: 'index.html', css: 'style.css', scss: 'style.scss', js: 'script.js', javascript: 'script.js', jsx: 'App.jsx',
  ts: 'index.ts', typescript: 'index.ts', tsx: 'App.tsx', py: 'main.py', python: 'main.py', java: 'Main.java', json: 'data.json',
  c: 'main.c', cpp: 'main.cpp', 'c++': 'main.cpp', cs: 'Program.cs', csharp: 'Program.cs', go: 'main.go', rs: 'main.rs', rust: 'main.rs',
  php: 'index.php', rb: 'main.rb', ruby: 'main.rb', sql: 'query.sql', xml: 'data.xml', yaml: 'config.yml', yml: 'config.yml', md: 'README.md', markdown: 'README.md'
}
export function parseLooseBlocks(text: string): LooseBlock[] {
  if (parseFileBlocks(text).length > 0) return []
  const lines = text.split(/\r?\n/)
  const out: LooseBlock[] = []
  const used = new Set<string>()
  let i = 0
  while (i < lines.length) {
    const open = FENCE_OPEN.exec(lines[i])
    if (!open) { i++; continue }
    const lang = (open[1] || '').trim().split(/[\s:{]/)[0].toLowerCase()
    let j = i + 1
    while (j < lines.length && !FENCE_CLOSE.test(lines[j])) j++
    if (j >= lines.length) break // not finished: ignore
    const body = lines.slice(i + 1, j)
    i = j + 1
    if (SKIP_LANGS.has(lang)) continue
    if (body.filter((l) => l.trim() !== '').length < 2) continue
    let name = NAME_FOR[lang] || (lang ? 'file.' + lang.replace(/[^a-z0-9]/g, '').slice(0, 6) : 'file.txt')
    if (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf('.')
      let n = 2
      while (used.has((name.slice(0, dot) + n + name.slice(dot)).toLowerCase())) n++
      name = name.slice(0, dot) + n + name.slice(dot)
    }
    used.add(name.toLowerCase())
    out.push({ lang, content: body.join('\n'), suggested: name })
  }
  return out
}

export function validFileName(p: string): boolean {
  const q = p.trim().replace(/\\/g, '/')
  return /^[\w][\w.\-\/ ]*\.[A-Za-z][A-Za-z0-9]{0,7}$/.test(q) && !q.split('/').includes('..') && !q.startsWith('/')
}
