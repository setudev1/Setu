// Runs Setu's Ollama code against a fake Ollama server, so model listing, chat, downloads, stopping and errors are
// checked without needing a real model. (Real models still need a real-computer test.)
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

type Seen = { path: string; body: any }[]
const seen: Seen = []
let mode: 'ok' | 'slow' | 'error' | 'badline' | 'notfound' = 'ok'

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {}
    seen.push({ path: req.url ?? '', body })
    if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.12.0' }))
    if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: [{ name: 'qwen2.5-coder:1.5b', size: 986000000, modified_at: '2026-10-01' }, { name: 'llama3.2:3b', size: 2000000000 }] }))
    if (req.url === '/api/show') return void res.end(JSON.stringify({ capabilities: body.model.includes('vl') ? ['completion', 'vision'] : ['completion'] }))
    if (req.url === '/api/chat') {
      if (mode === 'notfound') { res.statusCode = 404; return void res.end(JSON.stringify({ error: `model '${body.model}' not found` })) }
      if (mode === 'error') { res.statusCode = 500; return void res.end(JSON.stringify({ error: 'llama runner process has terminated' })) }
      if (mode === 'badline') { res.setHeader('Content-Type', 'text/html'); return void res.end('<html>not ollama</html>\n') }
      if (body.messages.length === 0) return void res.end(JSON.stringify({ done: true }))
      res.setHeader('Content-Type', 'application/x-ndjson')
      const parts = ['Hel', 'lo ', 'from ', 'Setu']
      let i = 0
      const tick = (): void => {
        if (i < parts.length) {
          // a JSON line can be split across two network chunks; the reader must cope
          const line = JSON.stringify({ message: { content: parts[i++] }, done: false }) + '\n'
          const cut = Math.floor(line.length / 2)
          res.write(line.slice(0, cut))
          setTimeout(() => { res.write(line.slice(cut)); setTimeout(tick, mode === 'slow' ? 60 : 1) }, 1)
        } else {
          res.end(JSON.stringify({ message: { content: '' }, done: true, eval_count: 4, prompt_eval_count: 12 }) + '\n')
        }
      }
      tick()
      return
    }
    if (req.url === '/api/pull') {
      res.write(JSON.stringify({ status: 'pulling manifest' }) + '\n')
      res.write(JSON.stringify({ status: 'pulling abc', total: 100, completed: 40 }) + '\n')
      res.write(JSON.stringify({ status: 'pulling abc', total: 100, completed: 100 }) + '\n')
      return void res.end(JSON.stringify({ status: 'success' }) + '\n')
    }
    res.statusCode = 404
    res.end('{}')
  })
})

let ol: typeof import('../src/main/ollama')
test.before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  process.env.SETU_OLLAMA_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  ol = await import('../src/main/ollama')
})
test.after(() => server.close())

test('status and model list', async () => {
  assert.deepEqual(await ol.getStatus(), { running: true, version: '0.12.0' })
  const list = await ol.listModels()
  assert.equal(list.length, 2)
  assert.equal(list[0].name, 'qwen2.5-coder:1.5b')
  assert.equal(list[1].modified, '')
})

test('vision detection uses what Ollama reports', async () => {
  assert.equal(await ol.supportsVision('qwen2.5vl:3b'), true)
  assert.equal(await ol.supportsVision('llama3.2:3b'), false)
})

test('chat streams every piece, even when a line arrives in two chunks', async () => {
  mode = 'ok'
  seen.length = 0
  let text = ''
  let info: any
  await ol.streamChat({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], signal: new AbortController().signal, onToken: (t) => (text += t), onDone: (i) => (info = i) })
  assert.equal(text, 'Hello from Setu')
  assert.deepEqual(info, { tokens: 4, promptTokens: 12 })
  const sent = seen.find((s) => s.path === '/api/chat')!.body
  assert.equal(sent.keep_alive, '30m')
  assert.equal(sent.options.num_ctx, 8192)
  assert.equal(sent.messages[0].role, 'system')
})

test('chat uses the memory window it is given', async () => {
  seen.length = 0
  await ol.streamChat({ model: 'llama3.2:3b', numCtx: 6144, messages: [{ role: 'user', content: 'hi' }], signal: new AbortController().signal, onToken: () => undefined, onDone: () => undefined })
  assert.equal(seen.find((s) => s.path === '/api/chat')!.body.options.num_ctx, 6144)
})

test('stopping a chat stops the stream', async () => {
  mode = 'slow'
  const ac = new AbortController()
  let text = ''
  const run = ol.streamChat({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], signal: ac.signal, onToken: (t) => { text += t; if (text.length >= 3) ac.abort() }, onDone: () => undefined })
  await assert.rejects(run)
  assert.ok(text.length < 15)
  mode = 'ok'
})

test('a model that is not installed gives a clear error', async () => {
  mode = 'notfound'
  await assert.rejects(ol.streamChat({ model: 'nope:1b', messages: [{ role: 'user', content: 'hi' }], signal: new AbortController().signal, onToken: () => undefined, onDone: () => undefined }), /not found/)
  mode = 'ok'
})

test('a crashed model runner gives an error, not a hang', async () => {
  mode = 'error'
  await assert.rejects(ol.streamChat({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], signal: new AbortController().signal, onToken: () => undefined, onDone: () => undefined }), /terminated/)
  mode = 'ok'
})

test('another program on the Ollama port gives a clear message, not a raw JSON error', async () => {
  mode = 'badline'
  await assert.rejects(ol.streamChat({ model: 'llama3.2:3b', messages: [{ role: 'user', content: 'hi' }], signal: new AbortController().signal, onToken: () => undefined, onDone: () => undefined }), /could not read/)
  mode = 'ok'
})

test('download reports progress up to 100 percent', async () => {
  const progress: number[] = []
  await ol.pullModel({ name: 'llama3.2:3b', signal: new AbortController().signal, onProgress: (p) => { if (p.total) progress.push(Math.round(((p.completed ?? 0) / p.total) * 100)) } })
  assert.deepEqual(progress, [40, 100])
})

test('warming a model sends the same memory window and keeps it loaded', async () => {
  seen.length = 0
  await ol.warmModel('llama3.2:3b', 6144)
  const sent = seen.find((s) => s.path === '/api/chat')!.body
  assert.deepEqual(sent.messages, [])
  assert.equal(sent.keep_alive, '30m')
  assert.equal(sent.options.num_ctx, 6144)
})

test('an unreachable Ollama is reported kindly', async () => {
  server.close()
  assert.equal((await ol.getStatus()).running, false)
  await assert.rejects(ol.listModels())
  assert.match(ol.friendlyError(new Error('fetch failed')), /Can't reach Ollama/)
})
