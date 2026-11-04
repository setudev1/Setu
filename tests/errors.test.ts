import test from 'node:test'
import assert from 'node:assert/strict'
import { explainPrompt, fixPrompt, hintFor } from '../src/renderer/src/lib/errors'

test('hintFor: recognises common beginner errors in plain words', () => {
  assert.match(hintFor('Error: listen EADDRINUSE: address already in use :::3000') ?? '', /port is already/)
  assert.match(hintFor("'npm' is not recognized as an internal or external command") ?? '', /not installed/)
  assert.match(hintFor("Error: Cannot find module 'express'") ?? '', /install/)
  assert.match(hintFor('ModuleNotFoundError: No module named requests') ?? '', /install/)
  assert.match(hintFor('npm ERR! enoent ENOENT: no such file or directory, open package.json') ?? '', /wrong folder/)
  assert.match(hintFor('SyntaxError: Unexpected token }') ?? '', /typing mistake/)
  assert.match(hintFor('ReferenceError: x is not defined') ?? '', /never created/)
  assert.match(hintFor("TypeError: Cannot read properties of undefined (reading 'map')") ?? '', /empty/)
  assert.match(hintFor('Error: connect ECONNREFUSED 127.0.0.1:5432') ?? '', /reach a server/)
  assert.match(hintFor('AssertionError: expected 3 to equal 4') ?? '', /test failed/)
  assert.equal(hintFor('all good'), null)
  assert.equal(hintFor(''), null)
})

test('hintFor: only looks at the end of very long output, and picks the most specific cause first', () => {
  const long = 'x'.repeat(20000) + '\nSyntaxError: Unexpected token'
  assert.match(hintFor(long) ?? '', /typing mistake/)
  assert.match(hintFor('FAIL tests/a.test.js\nCannot find module "foo"') ?? '', /install/)
})

test('prompts: explain asks for a teaching answer and no file changes; fix asks for a fix; long output is trimmed', () => {
  const e = explainPrompt('npm test', 'boom', 1)
  assert.match(e, /npm test/)
  assert.match(e, /Do not change any files yet/)
  assert.match(e, /beginner/)
  const f = fixPrompt('npm test', 'boom', null)
  assert.match(f, /code \?/)
  assert.match(f, /find the problem and fix it/)
  const big = fixPrompt('x', 'a'.repeat(9000), 1)
  assert.ok(big.includes('[...]') && big.length < 6400)
})
