// Setu reviews. People post a review as a public GitHub issue titled "[Review] ..." with a "Rating: N/5" line,
// and Setu reads them back live. Setu sends nothing about the user. Closing an issue on GitHub removes the review.
import { REVIEWS_REPO } from './config'

export type Review = { id: number; name: string; stars: number; text: string; at: number; url: string }
export type ReviewsResult = { ok: boolean; configured: boolean; reviews: Review[]; fetchedAt: number }

const TITLE_TAG = '[Review]'

type Issue = { number?: unknown; title?: unknown; body?: unknown; created_at?: unknown; html_url?: unknown; user?: { login?: unknown } | null; pull_request?: unknown; state?: unknown }

const clean = (t: string, max: number): string =>
  t
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`>_\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** Turns one GitHub issue into a review, or null if it is not a review. */
export function parseIssue(i: Issue): Review | null {
  if (!i || i.pull_request) return null
  const title = typeof i.title === 'string' ? i.title : ''
  const body = typeof i.body === 'string' ? i.body : ''
  if (!title.startsWith(TITLE_TAG)) return null
  const m = /Rating:\s*([1-5])\s*\/\s*5/i.exec(body)
  if (!m) return null
  const stars = Number(m[1])
  const text = clean(body.replace(/Rating:\s*[1-5]\s*\/\s*5/i, ''), 600)
  const url = typeof i.html_url === 'string' && /^https:\/\/github\.com\//.test(i.html_url) ? i.html_url : ''
  const at = typeof i.created_at === 'string' ? Date.parse(i.created_at) : NaN
  const id = typeof i.number === 'number' ? i.number : 0
  const login = i.user && typeof i.user.login === 'string' ? i.user.login : ''
  return { id, name: clean(login, 40) || 'A Setu user', stars, text, at: Number.isFinite(at) ? at : 0, url }
}

/** One review per person: when the same GitHub user posted several, only their newest counts. */
export function dedupeByPerson(list: Review[]): Review[] {
  const newest = new Map<string, Review>()
  const out: Review[] = []
  for (const r of list) {
    if (r.name === 'A Setu user') {
      out.push(r)
      continue
    }
    const key = r.name.toLowerCase()
    const have = newest.get(key)
    if (!have || r.at > have.at || (r.at === have.at && r.id > have.id)) newest.set(key, r)
  }
  return [...out, ...newest.values()]
}

/** Good first (4 to 5 stars), then the rest; highest stars, then newest. */
export function sortReviews(list: Review[]): Review[] {
  return list.slice().sort((a, b) => b.stars - a.stars || b.at - a.at)
}

export function summarize(list: Review[]): { count: number; average: number; counts: Record<1 | 2 | 3 | 4 | 5, number>; good: number; low: number } {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const r of list) {
    counts[r.stars as 1 | 2 | 3 | 4 | 5]++
    sum += r.stars
  }
  const count = list.length
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, counts, good: counts[4] + counts[5], low: counts[1] + counts[2] + counts[3] }
}

/** The public GitHub page where a person writes their review (opens in the browser). */
export function writeUrl(stars: unknown, text: unknown, repo: string = REVIEWS_REPO): string {
  const n = Math.min(5, Math.max(1, Math.round(Number(stars) || 0)))
  const t = clean(typeof text === 'string' ? text : '', 600)
  const params = new URLSearchParams({
    title: `${TITLE_TAG} ${n} out of 5`,
    body: `Rating: ${n}/5\n\n${t}`
  })
  return `https://github.com/${repo}/issues/new?${params.toString()}`
}

export async function fetchReviews(api: string = `https://api.github.com/repos/${REVIEWS_REPO}/issues?state=open&per_page=100&sort=created&direction=desc`): Promise<ReviewsResult> {
  const fetchedAt = Date.now()
  if (!REVIEWS_REPO && api.includes('//api.github.com/repos//')) return { ok: false, configured: false, reviews: [], fetchedAt }
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return { ok: false, configured: true, reviews: [], fetchedAt }
    const body: unknown = await res.json()
    const reviews = Array.isArray(body) ? (body.map((i) => parseIssue(i as Issue)).filter(Boolean) as Review[]) : []
    return { ok: true, configured: true, reviews: sortReviews(dedupeByPerson(reviews)), fetchedAt }
  } catch {
    return { ok: false, configured: true, reviews: [], fetchedAt }
  }
}
