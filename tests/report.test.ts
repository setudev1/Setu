import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { appendLog, lastLines, reportBody, reportUrl, scrub } from '../src/main/report'

const info = { version: '0.1.0', platform: 'win32', arch: 'x64', electron: '33.0.0', lines: [] as string[] }

test('scrub: removes home folders, user names and keys', () => {
  const home = 'C:\\Users\\Ansh'
  assert.equal(scrub('failed at C:\\Users\\Ansh\\proj\\a.ts', home), 'failed at ~\\proj\\a.ts')
  assert.equal(scrub('open C:/Users/Ansh/x', home), 'open ~/x')
  assert.equal(scrub('D:\\Users\\Someone Else\\x'.split(' ')[0], ''), '~')
  assert.equal(scrub('/home/riya/app/main.js', ''), '~/app/main.js')
  assert.equal(scrub('token ghp_abcdefghijklmnop1234 here', ''), 'token [removed] here')
  assert.equal(scrub('key sk-abcdefghijk12345', ''), 'key [removed]')
})

test('log: appends lines, keeps the last few, restarts when huge, never throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setu-log-'))
  const f = join(dir, 'setu.log')
  for (let i = 1; i <= 8; i++) appendLog(f, `error ${i}\nsecond line`, () => new Date('2026-11-08T10:00:00Z'))
  assert.deepEqual(lastLines(f, 2).map((l) => l.replace(/^\S+ /, '')), ['error 7 second line', 'error 8 second line'])
  writeFileSync(f, 'x'.repeat(210 * 1024))
  appendLog(f, 'fresh')
  assert.match(readFileSync(f, 'utf8'), /^\S+ fresh\n$/)
  appendLog(join(dir, 'no', 'such', 'folder', 'x.log'), 'ignored')
  assert.deepEqual(lastLines(join(dir, 'missing.log'), 3), [])
})

test('report: body has the note, the system and cleaned errors; URL stays short and points to GitHub', () => {
  const lines = ['2026 Error at C:\\Users\\Ansh\\a.ts', 'two', 'three', 'four', 'five', 'six']
  const b = reportBody({ ...info, lines }, 'It crashed when I opened a folder', 'C:\\Users\\Ansh')
  assert.match(b, /It crashed when I opened a folder/)
  assert.match(b, /Setu 0\.1\.0 · win32 x64/)
  assert.ok(!b.includes('Ansh'))
  assert.ok(!b.includes('Error at')) // only the last 5 lines are kept
  assert.match(reportBody(info, '', ''), /please describe/)
  const u = reportUrl({ ...info, lines: ['x'.repeat(790), 'y'.repeat(790), 'z'.repeat(790), 'a'.repeat(790), 'b'.repeat(790)] }, 'n'.repeat(3000), '', 'setudev1/Setu')
  assert.ok(u.length <= 7100)
  const parsed = new URL(u)
  assert.equal(parsed.origin + parsed.pathname, 'https://github.com/setudev1/Setu/issues/new')
  assert.equal(parsed.searchParams.get('title'), '[Bug] ')
})
