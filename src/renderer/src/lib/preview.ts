// Builds one self-contained page for the Preview panel from the project's own files.
// The page runs offline inside a locked box, so nothing in it can reach the internet or Setu itself.
import type { FileRead } from '../types'

export const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:"

type Reader = (path: string) => Promise<FileRead>

function localPath(ref: string): string | null {
  const clean = ref.split('#')[0].split('?')[0].trim()
  if (!clean || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(clean) || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return null
  if (clean.startsWith('/') || clean.includes('..') || clean.includes('\\')) return null
  return clean.replace(/^\.\//, '')
}

const esc = (s: string, tag: string): string => s.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`)

async function replaceAsync(input: string, re: RegExp, fn: (m: RegExpExecArray) => Promise<string>): Promise<string> {
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(input))) {
    parts.push(input.slice(last, m.index), await fn(m))
    last = m.index + m[0].length
  }
  parts.push(input.slice(last))
  return parts.join('')
}

export async function buildPreviewDoc(read: Reader): Promise<{ doc: string } | { empty: string }> {
  const index = await read('index.html')
  if (!index.exists || index.binary) {
    return { empty: 'There is no index.html in this folder yet. Ask Setu to build a page, and it will show up here.' }
  }
  let doc = index.content
  doc = await replaceAsync(doc, /<link\b[^>]*>/gi, async (m) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(m[0])) return m[0]
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1]
    const p = href ? localPath(href) : null
    if (!p) return `<!-- not loaded in preview (needs the internet): ${href ?? ''} -->`
    const f = await read(p).catch(() => ({ exists: false }) as FileRead)
    return f.exists && !f.binary ? `<style>\n${esc(f.content, 'style')}\n</style>` : `<!-- missing: ${p} -->`
  })
  doc = await replaceAsync(doc, /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, async (m) => {
    const p = localPath(m[2])
    if (!p) return `<!-- not loaded in preview (needs the internet): ${m[2]} -->`
    const f = await read(p).catch(() => ({ exists: false }) as FileRead)
    if (!(f.exists && !f.binary)) return `<!-- missing: ${p} -->`
    const type = /type\s*=\s*["']module["']/i.test(m[1] + m[3]) ? ' type="module"' : ''
    return `<script${type}>\n${esc(f.content, 'script')}\n</script>`
  })
  return { doc: `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">\n${doc}` }
}
