import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanCommand, detectCommands, isTrusted, startRun, trustFolder } from '../src/main/runner'

const dir = (): string => mkdtempSync(join(tmpdir(), 'setu-test-'))

test('commands must be one short line', () => {
  assert.equal(cleanCommand('  npm test '), 'npm test')
  assert.throws(() => cleanCommand('a\nb'))
  assert.throws(() => cleanCommand(''))
  assert.throws(() => cleanCommand('x'.repeat(400)))
})

test('detects npm scripts and ignores the default "no test" script', async () => {
  const d = dir()
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1', start: 'node a.js' } }))
  const s = await detectCommands(d)
  assert.deepEqual(s.map((x) => x.command), ['npm start'])
})

test('trust is remembered per folder', async () => {
  const d = dir()
  const f = join(d, 'trusted.json')
  assert.equal(await isTrusted(f, '/a/b'), false)
  await trustFolder(f, '/a/b')
  assert.equal(await isTrusted(f, '/A/B'), true)
  assert.equal(await isTrusted(f, '/other'), false)
})

test('a command runs, streams output and reports its exit code', async () => {
  const d = dir()
  const r = await new Promise<{ out: string; code: number | null }>((resolve) => {
    let out = ''
    startRun(d, 'node -e "console.log(\'hi\');process.exit(3)"', (t) => (out += t), (i) => resolve({ out, code: i.code }))
  })
  assert.match(r.out, /hi/)
  assert.equal(r.code, 3)
})
