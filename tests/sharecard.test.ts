import test from 'node:test'
import assert from 'node:assert/strict'
import { shortName } from '../src/renderer/src/lib/shareCard'

test('share card: project names are made short and readable', () => {
  assert.equal(shortName('calculator-app'), 'calculator app')
  assert.equal(shortName(''), 'my project')
  assert.equal(shortName('   '), 'my project')
  assert.ok(shortName('x'.repeat(100)).length <= 26)
  assert.ok(shortName('a-very-long-project-name-that-needs-cutting-down').endsWith('…'))
})
