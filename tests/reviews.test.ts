import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { fetchReviews, parseIssue, sortReviews, summarize, writeUrl } from '../src/main/reviews'

const issue = (over: Record<string, unknown> = {}) => ({
  number: 7, title: '[Review] 5 out of 5', body: 'Rating: 5/5\n\nLoved **it**, the <b>preview</b> is great.',
  created_at: '2026-11-09T10:00:00Z', html_url: 'https://github.com/setudev1/Setu/issues/7', user: { login: 'riya' }, ...over
})

test('parseIssue: reads stars, cleans text, ignores non-reviews', () => {
  const r = parseIssue(issue())!
  assert.equal(r.stars, 5)
  assert.equal(r.name, 'riya')
  assert.equal(r.text, 'Loved it, the preview is great.')
  assert.equal(r.url, 'https://github.com/setudev1/Setu/issues/7')
  assert.equal(parseIssue(issue({ title: 'Bug: crash' })), null)
  assert.equal(parseIssue(issue({ body: 'no rating here' })), null)
  assert.equal(parseIssue(issue({ body: 'Rating: 9/5' })), null)
  assert.equal(parseIssue(issue({ pull_request: {} })), null)
  assert.equal(parseIssue(issue({ html_url: 'http://evil.example/x' }))!.url, '')
  assert.equal(parseIssue(issue({ user: null }))!.name, 'A Setu user')
})

test('sort and summary: good first, highest stars then newest', () => {
  const a = parseIssue(issue({ number: 1, body: 'Rating: 3/5\n\nok', created_at: '2026-11-09T10:00:00Z' }))!
  const b = parseIssue(issue({ number: 2, body: 'Rating: 5/5\n\nnice', created_at: '2026-11-08T10:00:00Z' }))!
  const c = parseIssue(issue({ number: 3, body: 'Rating: 5/5\n\nnewer', created_at: '2026-11-09T12:00:00Z' }))!
  const d = parseIssue(issue({ number: 4, body: 'Rating: 2/5\n\nbug', created_at: '2026-11-09T11:00:00Z' }))!
  assert.deepEqual(sortReviews([a, b, c, d]).map((r) => r.id), [3, 2, 1, 4])
  const s = summarize([a, b, c, d])
  assert.equal(s.count, 4)
  assert.equal(s.average, 3.8)
  assert.equal(s.good, 2)
  assert.equal(s.low, 2)
  assert.equal(summarize([]).average, 0)
})

test('writeUrl: prefilled public issue, clamps stars, cleans text', () => {
  const u = new URL(writeUrl(9, 'Great <script>x</script> app', 'setudev1/Setu'))
  assert.equal(u.origin + u.pathname, 'https://github.com/setudev1/Setu/issues/new')
  assert.equal(u.searchParams.get('title'), '[Review] 5 out of 5')
  assert.match(u.searchParams.get('body') ?? '', /^Rating: 5\/5\n\nGreat x app$/)
  assert.equal(new URL(writeUrl('x', 5, 'a/b')).searchParams.get('title'), '[Review] 1 out of 5')
})

test('fetchReviews: reads a feed, skips non-reviews, errors stay quiet', async () => {
  const srv = http.createServer((req, res) => {
    if (req.url === '/ok') res.end(JSON.stringify([issue({ number: 1 }), issue({ number: 2, title: 'Question' }), issue({ number: 3, body: 'Rating: 2/5\n\nslow', user: { login: 'dev2' } })]))
    else { res.statusCode = 403; res.end('{}') }
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const port = (srv.address() as { port: number }).port
  const ok = await fetchReviews(`http://localhost:${port}/ok`)
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.reviews.map((r) => r.id), [1, 3])
  const bad = await fetchReviews(`http://localhost:${port}/limited`)
  assert.equal(bad.ok, false)
  assert.deepEqual(bad.reviews, [])
  srv.close()
})
