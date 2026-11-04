import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitState } from '../src/main/git'
import { readRules, searchProject, buildContext } from '../src/main/project'

const dir = (): string => mkdtempSync(join(tmpdir(), 'setu-proj-'))

test('search finds lines, ignores node_modules and short queries', async () => {
  const d = dir()
  writeFileSync(join(d, 'a.js'), 'const x = 1\nfunction Hello() {}\n')
  mkdirSync(join(d, 'node_modules'))
  writeFileSync(join(d, 'node_modules', 'b.js'), 'hello hello')
  const r = await searchProject(d, 'hello')
  assert.deepEqual(r.hits.map((h) => `${h.path}:${h.line}`), ['a.js:2'])
  assert.equal((await searchProject(d, 'h')).hits.length, 0)
})

test('SETU.md rules are read and capped', async () => {
  const d = dir()
  assert.equal(await readRules(d), null)
  writeFileSync(join(d, 'SETU.md'), 'Use tabs.\n' + 'x'.repeat(9000))
  const r = (await readRules(d))!
  assert.ok(r.startsWith('Use tabs.'))
  assert.equal(r.length, 4000)
})

test('files the user points at go first in the context', async () => {
  const d = dir()
  writeFileSync(join(d, 'a.js'), 'AAA')
  writeFileSync(join(d, 'b.js'), 'BBB')
  const c = await buildContext(d, 12000, ['b.js'])
  assert.ok(c.indexOf('the user pointed at this file') > -1)
  assert.ok(c.indexOf('--- b.js') < c.indexOf('--- a.js'))
})

test('git: not a repo, clean repo, changed repo', async () => {
  const d = dir()
  let g = await gitState(d)
  assert.equal(g.ok, false)
  const run = (...a: string[]): string => execFileSync('git', a, { cwd: d, stdio: 'pipe' }).toString()
  run('init', '-q'); run('config', 'user.email', 't@t'); run('config', 'user.name', 't')
  writeFileSync(join(d, 'a.txt'), 'one\n'); run('add', '.'); run('commit', '-qm', 'first')
  g = await gitState(d)
  assert.equal(g.ok && g.changed, 0)
  writeFileSync(join(d, 'a.txt'), 'two\n'); writeFileSync(join(d, 'new.txt'), 'n\n')
  g = await gitState(d)
  assert.ok(g.ok && g.changed === 2 && g.diff.includes('+two') && g.diff.includes('new.txt'))
})
