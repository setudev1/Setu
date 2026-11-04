import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFileBlocks } from '../src/renderer/src/lib/fileBlocks'

test('finds a FILE line followed by a code block', () => {
  const b = parseFileBlocks('Here you go\n\nFILE: src/a.js\n```js\nconsole.log(1)\n```\n')
  assert.equal(b.length, 1)
  assert.equal(b[0].path, 'src/a.js')
  assert.equal(b[0].content, 'console.log(1)')
  assert.equal(b[0].complete, true)
})

test('a code block without a FILE line is not a file', () => {
  assert.equal(parseFileBlocks('Try this:\n```js\nx()\n```').length, 0)
})

test('a cut-off block is marked incomplete', () => {
  const b = parseFileBlocks('FILE: a.js\n```js\nlet x =')
  assert.equal(b[0].complete, false)
})

test('the last version of a repeated file wins', () => {
  const b = parseFileBlocks('FILE: a.js\n```\n1\n```\nFILE: a.js\n```\n2\n```')
  assert.equal(b.length, 1)
  assert.equal(b[0].content, '2')
})
