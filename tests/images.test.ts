import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkCreds, cleanImagePrompt, imageReady, makeImage, setImageKey, useImageStore } from '../src/main/images'

// A plain stand-in for Electron's key protection, so this test runs on any computer.
const KEYDIR = mkdtempSync(join(tmpdir(), 'setu-keys-'))
useImageStore({
  dir: () => KEYDIR,
  available: () => true,
  encrypt: (s) => Buffer.from(s, 'utf8'),
  decrypt: (b) => b.toString('utf8')
})

const ACC = 'a'.repeat(32)
const TOK = 'T'.repeat(40)

test('rejects bad account id and token', () => {
  assert.throws(() => checkCreds('short', TOK), /Account ID/)
  assert.throws(() => checkCreds(ACC, 'x'), /token/)
})
test('cleans the prompt', () => {
  assert.equal(cleanImagePrompt('  a   diya \n glow '), 'a diya glow')
  assert.throws(() => cleanImagePrompt('   '), /Describe/)
  assert.equal(cleanImagePrompt('x'.repeat(5000)).length, 1500)
})
test('needs details before making an image', async () => {
  assert.equal(imageReady(), false)
  await assert.rejects(makeImage(null, 'a cat'), /Cloudflare details/)
})
test('makes and saves an image inside the project', async () => {
  setImageKey(ACC, TOK)
  assert.equal(imageReady(), true)
  const root = mkdtempSync(join(tmpdir(), 'setu-proj-'))
  let seen: { url: string; auth: string; body: string } | null = null
  const real = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url, auth: String((init.headers as Record<string, string>).Authorization), body: String(init.body) }
    return new Response(JSON.stringify({ success: true, result: { image: Buffer.from('JPEGDATA').toString('base64') } }), { status: 200 })
  }) as typeof fetch
  try {
    const r = await makeImage(root, 'a diya')
    assert.match(r.path ?? '', /^images\/setu-\d+\.jpg$/)
    assert.equal(readdirSync(join(root, 'images')).length, 1)
    assert.ok(seen!.url.includes(`/accounts/${ACC}/ai/run/@cf/black-forest-labs/flux-1-schnell`))
    assert.equal(seen!.auth, `Bearer ${TOK}`)
    assert.ok(seen!.body.includes('"steps":4'))
    globalThis.fetch = (async () => new Response('{}', { status: 429 })) as typeof fetch
    await assert.rejects(makeImage(root, 'again'), /free images/)
    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch
    await assert.rejects(makeImage(root, 'again'), /token/)
  } finally {
    globalThis.fetch = real
  }
})
