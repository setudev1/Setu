import test from 'node:test'
import assert from 'node:assert/strict'
import { CHALLENGES, challengeOfDay, dayKey, loadProgress, markDone, streak } from '../src/renderer/src/lib/challenges'

const mem = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } => {
  const data: Record<string, string> = {}
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

test('challenges: 30 complete, unique ones that ask for one index.html', () => {
  assert.equal(CHALLENGES.length, 30)
  assert.equal(new Set(CHALLENGES.map((c) => c.title)).size, 30)
  for (const c of CHALLENGES) {
    assert.ok(c.prompt.length > 40 && c.prompt.includes('index.html'), c.title)
  }
})

test('challenge of the day: same all day, different next day, never crashes', () => {
  assert.equal(challengeOfDay('2026-11-08').id, challengeOfDay('2026-11-08').id)
  assert.notEqual(challengeOfDay('2026-11-08').id, challengeOfDay('2026-11-09').id)
  for (const k of ['2000-01-01', '2026-12-31', '2099-02-28', 'garbage']) assert.ok(challengeOfDay(k))
  assert.equal(dayKey(new Date(2026, 10, 8)), '2026-11-08')
})

test('streak: counts days in a row, survives "today not done yet", resets after a gap', () => {
  const p = { done: ['2026-11-05', '2026-11-06', '2026-11-07'] }
  assert.equal(streak(p, '2026-11-07'), 3)
  assert.equal(streak(p, '2026-11-08'), 3) // yesterday counts until the day ends
  assert.equal(streak(p, '2026-11-09'), 0) // missed a whole day
  assert.equal(streak({ done: [] }, '2026-11-08'), 0)
  assert.equal(streak({ done: ['2026-02-28', '2026-03-01'] }, '2026-03-01'), 2) // across a month end
  assert.equal(streak({ done: ['2026-12-31', '2027-01-01'] }, '2027-01-01'), 2) // across a year end
})

test('progress: saved once per day, junk in storage is ignored, blocked storage does not crash', () => {
  const s = mem()
  markDone('2026-11-08', s)
  markDone('2026-11-08', s)
  assert.deepEqual(loadProgress(s).done, ['2026-11-08'])
  s.data['setu.challenges'] = '{"done":["x",5,"2026-11-09",null]}'
  assert.deepEqual(loadProgress(s).done, ['2026-11-09'])
  s.data['setu.challenges'] = 'not json'
  assert.deepEqual(loadProgress(s).done, [])
  const blocked = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
  assert.deepEqual(loadProgress(blocked).done, [])
  assert.doesNotThrow(() => markDone('2026-11-08', blocked))
})
