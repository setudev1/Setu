import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { checkForUpdate, isNewer, readFeed } from '../src/main/updates'

test('version comparison', () => {
  assert.equal(isNewer('0.13.0', '0.12.0'), true)
  assert.equal(isNewer('v1.0', '0.99.9'), true)
  assert.equal(isNewer('0.12.0', '0.12.0'), false)
  assert.equal(isNewer('0.11.9', '0.12.0'), false)
})

test('reads GitHub and Setu feed shapes, rejects bad ones', () => {
  assert.deepEqual(readFeed({ tag_name: 'v0.13.0', html_url: 'https://github.com/a/b/releases/tag/v0.13.0' }), { version: '0.13.0', url: 'https://github.com/a/b/releases/tag/v0.13.0' })
  assert.deepEqual(readFeed({ version: '1.2.3', url: 'https://x.com/d' }), { version: '1.2.3', url: 'https://x.com/d' })
  assert.equal(readFeed({ version: '1.2.3', url: 'http://x.com/d' }), null)
  assert.equal(readFeed({ version: 'abc', url: 'https://x.com' }), null)
  assert.equal(readFeed(null), null)
})

test('check: empty feed is off, newer is reported, errors stay quiet', async () => {
  assert.deepEqual(await checkForUpdate('0.12.0', ''), { available: false, configured: false })
  const srv = http.createServer((req, res) => {
    if (req.url === '/ok') res.end(JSON.stringify({ version: '0.13.0', url: 'https://example.com/get' }))
    else { res.statusCode = 500; res.end('x') }
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const port = (srv.address() as { port: number }).port
  const r = await checkForUpdate('0.12.0', `http://localhost:${port}/ok`)
  assert.equal(r.available, true)
  assert.equal(r.version, '0.13.0')
  assert.equal((await checkForUpdate('0.13.0', `http://localhost:${port}/ok`)).available, false)
  assert.equal((await checkForUpdate('0.12.0', `http://localhost:${port}/bad`)).available, false)
  srv.close()
})

test('reads the installer link and short notes from a GitHub release', () => {
  const f = readFeed({
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/setudev1/Setu/releases/tag/v0.2.0',
    body: '## What is new\n* Faster **chat**\n* Fixed a bug',
    assets: [
      { browser_download_url: 'https://github.com/setudev1/Setu/releases/download/v0.2.0/latest.yml' },
      { browser_download_url: 'https://github.com/setudev1/Setu/releases/download/v0.2.0/Setu-Setup.exe' }
    ]
  })
  assert.equal(f?.download, 'https://github.com/setudev1/Setu/releases/download/v0.2.0/Setu-Setup.exe')
  assert.match(f?.notes ?? '', /^What is new Faster chat Fixed a bug$/)
  // http or non-exe links are ignored; no assets is fine
  assert.equal(readFeed({ version: '1.0.0', url: 'https://x.com', download: 'http://x.com/a.exe' })?.download, undefined)
  assert.equal(readFeed({ tag_name: 'v1.0.0', html_url: 'https://x.com', assets: [] })?.download, undefined)
})

test('check: 404 (no release yet) is quiet, other errors are flagged as failed', async () => {
  const srv = http.createServer((req, res) => {
    res.statusCode = req.url === '/none' ? 404 : 500
    res.end('x')
  })
  await new Promise<void>((r) => srv.listen(0, r))
  const port = (srv.address() as { port: number }).port
  const a = await checkForUpdate('0.1.0', `http://localhost:${port}/none`)
  assert.equal(a.available, false)
  assert.equal(a.failed, false)
  const b = await checkForUpdate('0.1.0', `http://localhost:${port}/err`)
  assert.equal(b.failed, true)
  assert.equal(b.current, '0.1.0')
  srv.close()
})
