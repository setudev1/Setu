import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStyle, cleanLearned, parseStyle } from '../src/main/style'

test('cleanLearned trims, flattens and caps', () => {
  assert.deepEqual(cleanLearned(['  keep it\nshort  ', '', 5, 'x'.repeat(500)]).map((s) => s.length), [13, 160])
  assert.equal(cleanLearned(Array.from({ length: 40 }, (_, i) => `r${i}`)).length, 20)
  assert.deepEqual(cleanLearned('nope'), [])
})
test('learned preferences reach the prompt', () => {
  const t = buildStyle(parseStyle({ learned: ['use plain CSS'] })) ?? ''
  assert.ok(t.includes('- use plain CSS'))
  assert.equal(buildStyle(parseStyle({})), undefined)
})
