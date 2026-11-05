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
  const keys = ['sk-abcdefghijklmnop', 'sk-or-v1-abcdef0123456789abcdef', 'sk-ant-api03-abcdefghij', 'sk_exampleexample_notarealkey123456', 'ghp_abcdefghijklmnop', 'gho_abcdefghijklmnop', 'github_pat_abcdefghij_klmn', 'AIzaSyabcdefghijk-lmn', 'gsk_abcdefghijklmnopqrstu', 'hf_abcdefghijklmnopqrstuv', 'xoxb-1234567890-abcdefghij', 'AKIAABCDEFGHIJKLMNOP']
  for (const k of keys) assert.ok(!scrub(`error with ${k} in request`, 'C:\\Users\\Ansh Rai').includes(k.slice(4)), `key leaked: ${k.slice(0, 8)}`)
  assert.ok(!scrub('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789', '').includes('abcdefghijklmnopqrstuvwxyz'))
  const p = scrub('ENOENT C:\\Users\\Ansh Rai\\OneDrive\\Desktop\\setu\\x.js and /home/ansh/p.js', 'C:\\Users\\Ansh Rai')
  assert.ok(!/Ansh|ansh/.test(p), p)
})

test('reviews: fake, odd and hostile issues', () => {
  const ok = { number: 1, title: '[Review] 5 out of 5', body: 'Rating: 5/5\n\nlove it', created_at: '2026-11-09T00:00:00Z', html_url: 'https://github.com/x/y/issues/1', user: { login: 'ansh' } }
  assert.equal(parseIssue(ok)?.stars, 5)
