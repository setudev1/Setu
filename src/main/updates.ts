// Checks whether a newer Setu exists. It only reads a public address and never sends anything about the user.
import { UPDATE_FEED } from './config'

export type UpdateInfo = { available: boolean; version?: string; url?: string; download?: string; notes?: string; current?: string; configured: boolean; failed?: boolean }

function parts(v: string): number[] {
  return v.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
}

export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return false
}

// Accepts GitHub's release format ({tag_name, html_url}) or Setu's own ({version, url}).
export function readFeed(body: unknown): { version: string; url: string; download?: string; notes?: string } | null {
  const b = (body ?? {}) as { tag_name?: unknown; html_url?: unknown; version?: unknown; url?: unknown; body?: unknown; assets?: unknown; download?: unknown; notes?: unknown }
  const version = typeof b.tag_name === 'string' ? b.tag_name : typeof b.version === 'string' ? b.version : ''
  const url = typeof b.html_url === 'string' ? b.html_url : typeof b.url === 'string' ? b.url : ''
  if (!/^v?\d+(\.\d+){0,3}/.test(version) || !/^https:\/\//.test(url)) return null
  // The installer itself, when the release has one (GitHub assets, or a "download" field in Setu's own file).
  let download: string | undefined
  if (typeof b.download === 'string' && /^https:\/\//.test(b.download)) download = b.download
  if (!download && Array.isArray(b.assets)) {
    for (const a of b.assets as { browser_download_url?: unknown }[]) {
      const u = a?.browser_download_url
      if (typeof u === 'string' && /^https:\/\//.test(u) && /\.exe$/i.test(u)) {
        download = u
        break
      }
    }
  }
  const rawNotes = typeof b.body === 'string' ? b.body : typeof b.notes === 'string' ? b.notes : ''
  const notes = rawNotes.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return { version: version.replace(/^v/i, ''), url, ...(download ? { download } : {}), ...(notes ? { notes } : {}) }
}

export async function checkForUpdate(current: string, feed: string = UPDATE_FEED): Promise<UpdateInfo> {
  if (!feed) return { available: false, configured: false }
  try {
    const res = await fetch(feed, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    if (!res.ok) return { available: false, configured: true, current, failed: res.status !== 404 }
    const f = readFeed(await res.json())
    if (!f) return { available: false, configured: true, current, failed: true }
    return { available: isNewer(f.version, current), version: f.version, url: f.url, download: f.download, notes: f.notes, current, configured: true }
  } catch {
    return { available: false, configured: true, current, failed: true } // offline or blocked: the banner stays quiet
  }
}
