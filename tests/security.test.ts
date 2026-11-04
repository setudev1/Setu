import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { signatureVerdict } from '../src/main/ollamaSetup'

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}

test('screen code never writes raw HTML or evals text', () => {
  for (const f of walk('src/renderer/src')) {
    const t = readFileSync(f, 'utf8')
    assert.ok(!/dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=/.test(t), `risky code in ${f}`)
  }
})

test('main window stays sandboxed', () => {
  const t = readFileSync('src/main/index.ts', 'utf8')
  assert.match(t, /sandbox: true/)
  assert.match(t, /contextIsolation: true/)
  assert.match(t, /nodeIntegration: false/)
  assert.ok(!/webSecurity:\s*false/.test(t))
})

test('installer signature rules', () => {
  assert.equal(signatureVerdict('Valid', 'CN=Ollama Inc.').ok, true)
  assert.equal(signatureVerdict('Valid', 'CN=Someone Else').ok, false)
  assert.equal(signatureVerdict('HashMismatch', 'CN=Ollama').ok, false)
  assert.equal(signatureVerdict('NotTrusted', '').ok, false)
  assert.equal(signatureVerdict('NotSigned', '').ok, true)
  assert.equal(signatureVerdict('UnknownError', '').ok, true)
})
