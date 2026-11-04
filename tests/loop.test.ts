import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLoop } from '../src/renderer/src/lib/loop'

test('not a loop command', () => assert.equal(parseLoop('hello'), null))
test('minutes and hours', () => {
  assert.deepEqual(parseLoop('/loop 10m check tests'), { kind: 'start', everyMin: 10, prompt: 'check tests' })
  assert.deepEqual(parseLoop('/loop 2h review'), { kind: 'start', everyMin: 120, prompt: 'review' })
})
test('stop', () => assert.deepEqual(parseLoop('/loop stop'), { kind: 'stop' }))
test('bad input', () => {
  assert.equal(parseLoop('/loop')?.kind, 'bad')
  assert.equal(parseLoop('/loop 5 hi')?.kind, 'bad')
  assert.equal(parseLoop('/loop 0m hi')?.kind, 'bad')
  assert.equal(parseLoop('/loop 5h hi')?.kind, 'bad')
})
