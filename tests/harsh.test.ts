// Hostile and odd inputs. These tests try to break Setu's safety rules and parsers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanRelPath, resolveInside } from '../src/main/fsGuard'
import { parseFileBlocks } from '../src/renderer/src/lib/fileBlocks'
import { scrub } from '../src/main/report'
import { parseIssue, sortReviews, writeUrl, dedupeByPerson } from '../src/main/reviews'
import { readFeed, isNewer } from '../src/main/updates'
import { checkTarget, parseAction } from '../src/main/qa'
import { cleanCommand } from '../src/main/runner'

test('paths: every known escape trick is refused', () => {
  const bad = ['../x', '..\\x', 'a/../../x', '/etc/passwd', '\\\\server\\share\\f', 'C:\\Windows\\x', 'c:/x', 'a:b', '.git/config', '.GIT/config', 'a/.git/hooks/pre-commit', 'node_modules/x/y.js', '.setu/key', 'con', 'NUL.txt', 'a/aux.js', 'file.', 'a/b /c', 'a/b./c', 'x<y', 'x|y', 'x?y', 'x*y', 'a\0b', '', '   ', '.', './', 'a'.repeat(300), 'file.txt:stream', 'a/COM1', 'lpt9.log']
  for (const p of bad) assert.throws(() => cleanRelPath(p), undefined, `should refuse: ${JSON.stringify(p).slice(0, 40)}`)
  for (const p of [null, undefined, 5, {}, [], ['a']]) assert.throws(() => cleanRelPath(p as never))
})

test('paths: normal names still work', () => {
  for (const p of ['index.html', 'src/app.js', './src//app.js', 'a b/c d.txt', '.gitignore', '.env.example', 'src\\win\\path.ts', 'ünï/çode.js', 'dist/node_modules_fix.js'])
    assert.doesNotThrow(() => cleanRelPath(p), p)
})

test('paths: a symlink that points outside the project is refused', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'setu-h-')))
  const root = join(base, 'proj')
  const outside = join(base, 'outside')
  mkdirSync(root)
  mkdirSync(outside)
  writeFileSync(join(outside, 'secret.txt'), 'x')
  try {
    symlinkSync(outside, join(root, 'link'), 'dir')
  } catch {
    return // this computer does not allow symlinks (Windows without admin): nothing to test
  }
  await assert.rejects(resolveInside(root, 'link/secret.txt'), /Not allowed/)
  await assert.rejects(resolveInside(root, 'link/new/deep/file.txt'), /Not allowed/)
  assert.ok(await resolveInside(root, 'ok/new.txt'))
})

test('file blocks: weird replies never crash and never invent files', () => {
  assert.deepEqual(parseFileBlocks(''), [])
  assert.deepEqual(parseFileBlocks('```js\nlet a\n```'), [])
  assert.deepEqual(parseFileBlocks('FILE: a.js'), [])
  assert.deepEqual(parseFileBlocks('FILE: a.js\n\n\n'), [])
  const unclosed = parseFileBlocks('FILE: a.js\n```js\nlet a = 1')
  assert.equal(unclosed.length, 1)
  assert.equal(unclosed[0].complete, false)
  const two = parseFileBlocks('FILE: a.js\n```\n1\n```\nFILE: A.JS\n```\n2\n```')
  assert.equal(two.length, 1)
  assert.equal(two[0].content, '2')
  const crlf = parseFileBlocks('FILE: a.js\r\n```js\r\nx\r\n```\r\n')
  assert.equal(crlf[0].content, 'x')
  const big = 'FILE: a.js\n```\n' + 'x\n'.repeat(200000) + '```'
  const t0 = Date.now()
  assert.equal(parseFileBlocks(big).length, 1)
  assert.ok(Date.now() - t0 < 1500, 'large reply parses fast')
  const evil = parseFileBlocks('FILE: ../../etc/passwd\n```\nroot\n```')
  assert.equal(evil.length, 1)
  assert.throws(() => cleanRelPath(evil[0].path)) // found, but refused when applied
  // a regex-bomb style line must not hang
  const t1 = Date.now()
  parseFileBlocks('FILE:' + ' `'.repeat(20000) + 'x')
  assert.ok(Date.now() - t1 < 1500)
})

test('scrub: removes keys of every common kind and personal folders', () => {
  const keys = ['sk-abcdefghijklmnop', 'sk-or-v1-abcdef0123456789abcdef', 'sk-ant-api03-abcdefghij', 'sk_opwx4lif_Yrwp44jxg0wecz01jPOLaccb', 'ghp_abcdefghijklmnop', 'gho_abcdefghijklmnop', 'github_pat_abcdefghij_klmn', 'AIzaSyabcdefghijk-lmn', 'gsk_abcdefghijklmnopqrstu', 'hf_abcdefghijklmnopqrstuv', 'xoxb-1234567890-abcdefghij', 'AKIAABCDEFGHIJKLMNOP']
  for (const k of keys) assert.ok(!scrub(`error with ${k} in request`, 'C:\\Users\\Ansh Rai').includes(k.slice(4)), `key leaked: ${k.slice(0, 8)}`)
  assert.ok(!scrub('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789', '').includes('abcdefghijklmnopqrstuvwxyz'))
  const p = scrub('ENOENT C:\\Users\\Ansh Rai\\OneDrive\\Desktop\\setu\\x.js and /home/ansh/p.js', 'C:\\Users\\Ansh Rai')
  assert.ok(!/Ansh|ansh/.test(p), p)
})

test('reviews: fake, odd and hostile issues', () => {
  const ok = { number: 1, title: '[Review] 5 out of 5', body: 'Rating: 5/5\n\nlove it', created_at: '2026-11-09T00:00:00Z', html_url: 'https://github.com/x/y/issues/1', user: { login: 'ansh' } }
  assert.equal(parseIssue(ok)?.stars, 5)
  assert.equal(parseIssue({ ...ok, body: 'Rating: 50/5' }), null)
  assert.equal(parseIssue({ ...ok, body: 'Rating: 0/5' }), null)
  assert.equal(parseIssue({ ...ok, body: 'Rating: 6/5' }), null)
  assert.equal(parseIssue({ ...ok, title: 'Review 5' }), null)
  assert.equal(parseIssue({ ...ok, pull_request: {} }), null)
  assert.equal(parseIssue(null as never), null)
  assert.equal(parseIssue({ ...ok, html_url: 'javascript:alert(1)' })?.url, '')
  const x = parseIssue({ ...ok, body: 'Rating: 4/5\n<script>alert(1)</script><img src=x onerror=alert(1)> [link](javascript:alert(1))' })!
  assert.ok(!/[<>]/.test(x.text))
  assert.ok(x.text.length <= 600)
  assert.ok(parseIssue({ ...ok, body: 'Rating: 4/5 ' + 'a'.repeat(100000) })!.text.length <= 600)
  assert.ok(sortReviews([{ ...parseIssue(ok)!, stars: 1 }, parseIssue(ok)!])[0].stars === 5)
})

test('reviews: one person cannot flood the list with many 5-star posts', () => {
  const mk = (id: number, name: string, stars: number, at: number) => ({ id, name, stars, text: '', at, url: '' })
  const list = [mk(1, 'bot', 5, 1), mk(2, 'bot', 5, 2), mk(3, 'bot', 5, 3), mk(4, 'real', 3, 2)]
  const d = dedupeByPerson(list)
  assert.equal(d.length, 2)
  assert.equal(d.find((r) => r.name === 'bot')!.id, 3) // newest one kept
  assert.equal(dedupeByPerson([mk(1, 'A Setu user', 5, 1), mk(2, 'A Setu user', 4, 2)]).length, 2) // unknown names are not merged
})

test('review link: quotes, line breaks and emoji do not break the address', () => {
  const u = new URL(writeUrl(9, 'He said "great"\n& more 🚀 <b>x</b>'))
  assert.equal(u.hostname, 'github.com')
  assert.match(u.searchParams.get('title') ?? '', /^\[Review\] 5 out of 5$/)
  assert.ok(!(u.searchParams.get('body') ?? '').includes('<b>'))
  assert.match(new URL(writeUrl('abc', null)).searchParams.get('title') ?? '', /1 out of 5/)
})

test('updates: odd version names and feeds', () => {
  assert.equal(isNewer('0.1.1', '0.1.0'), true)
  assert.equal(isNewer('0.1.0', '0.1.0'), false)
  assert.equal(isNewer('0.10.0', '0.9.0'), true)
  assert.equal(isNewer('1.0.0-beta', '1.0.0'), false)
  assert.equal(isNewer('abc', '0.1.0'), false)
  assert.equal(readFeed({ tag_name: 'latest', html_url: 'https://x.y/z' }), null)
  assert.equal(readFeed({ tag_name: 'v0.2.0', html_url: 'http://x.y/z' }), null)
  assert.equal(readFeed({ tag_name: 'v0.2.0', html_url: 'javascript:1' }), null)
  assert.equal(readFeed(null), null)
  assert.equal(readFeed('x'), null)
  assert.equal(readFeed({ tag_name: 'v0.2.0', html_url: 'https://x.y/z', assets: [null, 5, { browser_download_url: 'http://x/a.exe' }, { browser_download_url: 'https://x/a.zip' }] })?.download, undefined)
  assert.equal(readFeed({ tag_name: 'v0.2.0', html_url: 'https://x.y/z', body: 'a'.repeat(5000) })!.notes!.length, 200)
})

test('test-window addresses: dangerous targets are refused', () => {
  const root = process.platform === 'win32' ? 'C:\\proj' : '/home/me/proj'
  for (const t of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>1</script>', 'ftp://x.y', 'http://example.com', 'http://localhost.evil.com', 'http://127.0.0.1.evil.com', 'https://user:pass@example.com', 'x'.repeat(600), '', '../secret.html', 'notes.txt'])
    assert.ok('error' in checkTarget(t, root), `should refuse ${t.slice(0, 30)}`)
  assert.ok('url' in checkTarget('http://localhost:5173', root))
  assert.ok('url' in checkTarget('https://example.com', root))
  assert.ok('url' in checkTarget('index.html', root))
})

test('test-window actions: nonsense from a model is ignored, not obeyed', () => {
  assert.equal(parseAction('', 1024, 640), null)
  assert.equal(parseAction('{"action":"rm -rf /"}', 1024, 640), null)
  const a = parseAction('{"thought":"x","action":{"type":"click","x":99999,"y":-5}}', 1024, 640)
  if (a && a.action.type === 'click') {
    assert.ok(a.action.x <= 1024 && a.action.x >= 0 && a.action.y >= 0 && a.action.y <= 640)
  }
})

test('run command: multi-line and huge commands are refused', () => {
  for (const c of ['a\nb', 'a\rb', 'x'.repeat(301), '', '  ', null, 5]) assert.throws(() => cleanCommand(c as never))
  assert.equal(cleanCommand('  npm test  '), 'npm test')
})

import { applyChanges, restoreCheckpoint } from '../src/main/checkpoints'
import { promises as fsp } from 'node:fs'

test('apply: one bad path means nothing at all is written', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'setu-a-')))
  const root = join(base, 'p'); const store = join(base, 'store')
  mkdirSync(root); mkdirSync(store)
  await assert.rejects(applyChanges(root, store, 't', [{ path: 'good.txt', content: 'x' }, { path: '../evil.txt', content: 'y' }]))
  assert.deepEqual(await fsp.readdir(root), [])
  await assert.rejects(applyChanges(root, store, 't', [{ path: 'a.txt', content: 5 as never }]))
  await assert.rejects(applyChanges(root, store, 't', []))
  await assert.rejects(applyChanges(root, store, 't', Array.from({ length: 51 }, (_, i) => ({ path: `f${i}.txt`, content: 'x' }))), /Too many/)
  await assert.rejects(applyChanges(root, store, 't', [{ path: 'big.txt', content: 'x'.repeat(1_000_001) }]), /too large/)
  assert.deepEqual(await fsp.readdir(root), [])
})

test('apply and undo: new files vanish, old files come back, line endings are kept', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'setu-u-')))
  const root = join(base, 'p'); const store = join(base, 'store')
  mkdirSync(root); mkdirSync(store)
  writeFileSync(join(root, 'old.txt'), 'one\r\ntwo\r\n')
  const r = await applyChanges(root, store, 'edit', [{ path: 'old.txt', content: 'three\nfour' }, { path: 'deep/new/file.txt', content: 'hello' }])
  assert.equal(await fsp.readFile(join(root, 'old.txt'), 'utf8'), 'three\r\nfour\r\n')
  assert.equal(await fsp.readFile(join(root, 'deep/new/file.txt'), 'utf8'), 'hello\n')
  await restoreCheckpoint(root, store, r.checkpointId)
  assert.equal(await fsp.readFile(join(root, 'old.txt'), 'utf8'), 'one\r\ntwo\r\n')
  assert.deepEqual((await fsp.readdir(root)).sort(), ['old.txt'])
  await assert.rejects(restoreCheckpoint(root, store, '../../etc'))
})

test('apply: writing over a folder is refused', async () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'setu-f-')))
  const root = join(base, 'p'); const store = join(base, 'store')
  mkdirSync(root); mkdirSync(join(root, 'dir')); mkdirSync(store)
  await assert.rejects(applyChanges(root, store, 't', [{ path: 'dir', content: 'x' }]), /folder/)
})
