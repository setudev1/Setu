import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTES_MAX, trimNotes } from '../src/main/project'

test('trimNotes keeps short notes and trims blanks', () => {
  assert.equal(trimNotes('  - a\r\n- b  '), '- a\n- b')
})
test('trimNotes keeps the newest end of long notes', () => {
  const t = trimNotes('old'.repeat(3000) + 'NEWEST')
  assert.equal(t.length, NOTES_MAX)
  assert.ok(t.endsWith('NEWEST'))
})
