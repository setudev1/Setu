// Problem reports and the small error log. A report is a prefilled public GitHub issue the person reads and sends
// themselves. It holds the Setu version, the system name, and the last few error lines with personal paths removed.
// Setu never sends anything by itself.
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { REVIEWS_REPO } from './config'

const MAX_LOG = 200 * 1024

/** Replaces the user's folders and name in a text with short stand-ins. */
export function scrub(text: string, home: string): string {
  let t = String(text ?? '')
  const variants = new Set<string>()
  if (home) {
    variants.add(home)
    variants.add(home.replace(/\\/g, '/'))
    variants.add(home.replace(/\//g, '\\'))
  }
  for (const h of variants) if (h.length > 3) t = t.split(h).join('~')
  t = t.replace(/([A-Za-z]:)?[\\/]Users[\\/][^\\/\s"']+/gi, '~').replace(/\/home\/[^/\s"']+/g, '~')
  // keys and long secrets
  t = t.replace(/\b(sk[-_][A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}|AIza[0-9A-Za-z_-]{10,}|gsk_[A-Za-z0-9]{10,}|hf_[A-Za-z0-9]{10,}|xox[abprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{12,})/g, '[removed]')
  t = t.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{12,}/gi, '$1 [removed]')
  return t
}

/** Adds one line to the log, starts over if it grows too big. Never throws. */
export function appendLog(file: string, message: string, now: () => Date = () => new Date()): void {
  try {
    if (existsSync(file) && statSync(file).size > MAX_LOG) writeFileSync(file, '')
    const line = `${now().toISOString()} ${String(message).replace(/\s+/g, ' ').slice(0, 800)}\n`
    appendFileSync(file, line, 'utf8')
  } catch {
    /* logging must never break Setu */
  }
}

export function lastLines(file: string, n: number): string[] {
  try {
    if (!existsSync(file)) return []
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-n)
  } catch {
    return []
  }
}

export type ReportInfo = { version: string; platform: string; arch: string; electron: string; lines: string[] }

export function reportBody(info: ReportInfo, note: string, home: string): string {
  const about = `Setu ${info.version} · ${info.platform} ${info.arch} · Electron ${info.electron}`
  const lines = info.lines.map((l) => scrub(l, home)).slice(-5)
  const parts = [
    '**What happened?**',
    scrub(String(note ?? ''), home).replace(/\r/g, '').trim().slice(0, 1500) || '(please describe what you were doing)',
    '',
    '**About my computer**',
    about
  ]
  if (lines.length) parts.push('', '**Recent errors** (personal folders removed)', '```', ...lines, '```')
  return parts.join('\n')
}

/** The public GitHub page for a bug report. The URL is kept short so the browser accepts it. */
export function reportUrl(info: ReportInfo, note: string, home: string, repo: string = REVIEWS_REPO): string {
  let body = reportBody(info, note, home)
  const make = (b: string): string =>
    `https://github.com/${repo}/issues/new?${new URLSearchParams({ title: '[Bug] ', body: b }).toString()}`
  let url = make(body)
  while (url.length > 7000 && body.length > 300) {
    body = body.slice(0, Math.floor(body.length * 0.8))
    url = make(body)
  }
  return url
}
