// Real files, real processes: checkpoints, project folders, wallpaper and the Run button.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyChanges, listCheckpoints, restoreCheckpoint } from '../src/main/checkpoints'
import { addSpace, getState, removeSpace, selectSpace } from '../src/main/spaces'
import { setWallpaper, getWallpaper, clearWallpaper, setLook, getWallpaperFile } from '../src/main/wallpaper'
import { startRun, stopRun, isRunning } from '../src/main/runner'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'setu-sys-'))

test('apply then restore puts every file back, including deleting files that were new', async () => {
  const root = tmp(), store = tmp()
  writeFileSync(join(root, 'a.txt'), 'old A\n')
  const r = await applyChanges(root, store, 'edit', [{ path: 'a.txt', content: 'new A' }, { path: 'deep/er/b.txt', content: 'B' }])
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'new A\n')
  assert.ok(existsSync(join(root, 'deep/er/b.txt')))
  await restoreCheckpoint(root, store, r.checkpointId)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'old A\n')
  assert.ok(!existsSync(join(root, 'deep')), 'empty folders created by the change are removed')
})

test('a restore can itself be undone', async () => {
  const root = tmp(), store = tmp()
  writeFileSync(join(root, 'a.txt'), '1\n')
  const r = await applyChanges(root, store, 'x', [{ path: 'a.txt', content: '2' }])
  const back = await restoreCheckpoint(root, store, r.checkpointId)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), '1\n')
  await restoreCheckpoint(root, store, back.undoCheckpointId)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), '2\n')
})

test('a bad path in a batch writes NOTHING (all or none)', async () => {
  const root = tmp(), store = tmp()
  await assert.rejects(applyChanges(root, store, 'x', [{ path: 'ok.txt', content: 'hi' }, { path: '../evil.txt', content: 'x' }]))
  assert.ok(!existsSync(join(root, 'ok.txt')))
  writeFileSync(join(root, 'file'), 'i am a file')
  await assert.rejects(applyChanges(root, store, 'x', [{ path: 'ok2.txt', content: 'hi' }, { path: 'file/inside.txt', content: 'x' }]))
  assert.ok(!existsSync(join(root, 'ok2.txt')))
})

test('limits: empty, too many, huge, wrong types', async () => {
  const root = tmp(), store = tmp()
  await assert.rejects(applyChanges(root, store, 'x', []))
  await assert.rejects(applyChanges(root, store, 'x', Array.from({ length: 51 }, (_, i) => ({ path: `f${i}.txt`, content: 'a' }))))
  await assert.rejects(applyChanges(root, store, 'x', [{ path: 'big.txt', content: 'a'.repeat(1_000_001) }]))
  await assert.rejects(applyChanges(root, store, 'x', [{ path: 'n.txt', content: 5 as never }]))
  await assert.rejects(applyChanges(root, store, 'x', null as never))
  mkdirSync(join(root, 'dir'))
  await assert.rejects(applyChanges(root, store, 'x', [{ path: 'dir', content: 'x' }]))
})

test('CRLF files keep their line endings; same file twice in a batch writes once', async () => {
  const root = tmp(), store = tmp()
  writeFileSync(join(root, 'w.txt'), 'a\r\nb\r\n')
  await applyChanges(root, store, 'x', [{ path: 'w.txt', content: 'a\nb\nc' }, { path: 'w.txt', content: 'last wins' }])
  assert.equal(readFileSync(join(root, 'w.txt'), 'utf8'), 'last wins\r\n')
})

test('restore refuses forged ids and unknown ids', async () => {
  const root = tmp(), store = tmp()
  for (const id of ['../../etc', 'a/b', '', 'x y', '..']) await assert.rejects(restoreCheckpoint(root, store, id))
  await assert.rejects(restoreCheckpoint(root, store, 'does-not-exist'))
  assert.deepEqual(await listCheckpoints(join(store, 'nope')), [])
})

test('a forged manifest cannot make restore write outside the project', async () => {
  const root = tmp(), store = tmp(), outside = tmp()
  mkdirSync(join(store, '111-abc/files'), { recursive: true })
  writeFileSync(join(store, '111-abc/files/0.bak'), 'pwned')
  writeFileSync(join(store, '111-abc/manifest.json'), JSON.stringify({ id: '111-abc', label: 'x', createdAt: 'x', files: [{ path: '../' + outside.split(/[\\/]/).pop() + '/p.txt', existed: true }, { path: '/etc/cron.d/x', existed: true }] }))
  await assert.rejects(restoreCheckpoint(root, store, '111-abc'))
  assert.equal(readdirSync(outside).length, 0)
})

test('many checkpoints: list is newest first and capped at 100', async () => {
  const root = tmp(), store = tmp()
  for (let i = 0; i < 105; i++) await applyChanges(root, store, `n${i}`, [{ path: 'c.txt', content: String(i) }])
  const l = await listCheckpoints(store)
  assert.equal(l.length, 100)
  assert.equal(l[0].label, 'n104')
})

test('project folders: add, select, remove, vanished folders, junk file', async () => {
  const file = join(tmp(), 'spaces.json'), a = tmp(), b = tmp()
  await addSpace(file, a); const s = await addSpace(file, b)
  assert.equal(s.spaces.length, 2); assert.equal(s.active, b)
  await assert.rejects(addSpace(file, join(a, 'nope')))
  await assert.rejects(selectSpace(file, '/not/added'))
  assert.equal((await selectSpace(file, a)).active, a)
  assert.equal((await removeSpace(file, a)).spaces.length, 1)
  writeFileSync(file, '{{{ not json'); assert.deepEqual(await getState(file), { spaces: [], active: null })
})

test('wallpaper: types, size rules, replace, clear, look clamping, corrupted settings', async () => {
  const dir = join(tmp(), 'wp'), src = tmp()
  writeFileSync(join(src, 'a.png'), 'x'); writeFileSync(join(src, 'b.exe'), 'x'); writeFileSync(join(src, 'c.mp4'), 'x')
  await assert.rejects(setWallpaper(dir, join(src, 'b.exe')))
  await assert.rejects(setWallpaper(dir, join(src, 'missing.png')))
  await assert.rejects(setWallpaper(dir, src))
  let s = await setWallpaper(dir, join(src, 'a.png')); assert.equal(s.kind, 'image')
  const first = await getWallpaperFile(dir)
  await new Promise((r) => setTimeout(r, 5))
  s = await setWallpaper(dir, join(src, 'c.mp4')); assert.equal(s.kind, 'video')
  assert.ok(!existsSync(first as string), 'old wallpaper file is deleted')
  s = await setLook(dir, { dim: 99, blur: -5 }); assert.equal(s.dim, 0.9); assert.equal(s.blur, 0)
  s = await setLook(dir, { dim: 'abc' as never, blur: NaN as never }); assert.ok(Number.isFinite(s.dim) && Number.isFinite(s.blur))
  s = await clearWallpaper(dir); assert.equal(s.url, null)
  writeFileSync(join(dir, 'wallpaper.json'), 'garbage'); await getWallpaper(dir)
})

const runIt = (cmd: string, root = tmp()): Promise<{ out: string; code: number | null; stopped: boolean }> =>
  new Promise((resolve) => {
    let out = ''
    startRun(root, cmd, (t) => (out += t), (i) => resolve({ out, code: i.code, stopped: i.stopped }))
  })

test('Run: output, exit codes, folder, one at a time, stop kills the whole tree', async () => {
  const root = tmp()
  const ok = await runIt('node -e "console.log(process.cwd().length>0, 40+2)"', root)
  assert.match(ok.out, /true 42/); assert.equal(ok.code, 0)
  const bad = await runIt('node -e "process.exit(3)"'); assert.equal(bad.code, 3)
  const nf = await runIt('definitely-not-a-command-xyz'); assert.notEqual(nf.code, 0)
  const p = new Promise<{ stopped: boolean }>((res) => startRun(root, 'node -e "setInterval(()=>{},1000)"', () => undefined, (i) => res(i)))
  assert.ok(isRunning())
  assert.throws(() => startRun(root, 'echo hi', () => undefined, () => undefined), /already running/i)
  stopRun()
  const r = await p; assert.equal(r.stopped, true); assert.ok(!isRunning())
})

test('Run: output is capped and unicode survives', async () => {
  const big = await runIt(`node -e "process.stdout.write('x'.repeat(500000))"`)
  assert.ok(big.out.length < 210_000, `got ${big.out.length}`); assert.match(big.out, /output cut off/)
  const u = await runIt(`node -e "console.log('नमस्ते ₹ 🙂')"`); assert.match(u.out, /नमस्ते ₹ 🙂/)
})
