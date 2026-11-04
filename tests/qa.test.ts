import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { checkTarget, parseAction, reportText, runQa, type QaAction } from '../src/main/qa'

test('parseAction: reads clean JSON, fenced JSON and replies with extra words', () => {
  assert.deepEqual(parseAction('{"thought":"open","action":"click","x":10,"y":20}')?.action, { kind: 'click', x: 10, y: 20 })
  const fenced = parseAction('Sure!\n```json\n{"action":"type","text":"hello"}\n```\nDone.')
  assert.deepEqual(fenced?.action, { kind: 'type', text: 'hello' })
  assert.deepEqual(parseAction('{"action":"key","key":"Enter"} then more {text}')?.action, { kind: 'key', key: 'Enter' })
})

test('parseAction: clamps points, limits text and scroll, rejects bad or unsafe input', () => {
  assert.deepEqual(parseAction('{"action":"click","x":5000,"y":-4}')?.action, { kind: 'click', x: 1023, y: 0 })
  assert.deepEqual(parseAction('{"action":"scroll","dy":99999}')?.action, { kind: 'scroll', dy: 800 })
  assert.equal((parseAction(`{"action":"type","text":"${'a'.repeat(500)}"}`)?.action as { text: string }).text.length, 200)
  assert.equal(parseAction('{"action":"key","key":"Delete"}'), null)
  assert.equal(parseAction('{"action":"launch","cmd":"calc"}'), null)
  assert.equal(parseAction('{"action":"click","x":"abc","y":1}'), null)
  assert.equal(parseAction('no json here'), null)
  assert.equal(parseAction('{"action":"type","text":"   "}'), null)
})

test('parseAction: done keeps the verdict, summary and at most 5 bugs', () => {
  const a = parseAction('{"action":"done","verdict":"fail","summary":"Button does nothing","bugs":["a","b","c","d","e","f"]}')?.action
  assert.equal(a?.kind, 'done')
  assert.equal((a as { bugs: string[] }).bugs.length, 5)
  assert.equal((parseAction('{"action":"done","verdict":"maybe"}')?.action as { verdict: string }).verdict, 'fail')
})

test('checkTarget: allows localhost, https and project html files; refuses the rest', () => {
  assert.ok('url' in checkTarget('http://localhost:5173', null))
  assert.ok('url' in checkTarget('https://example.com/app', null))
  assert.ok('error' in checkTarget('http://example.com', null))
  assert.ok('error' in checkTarget('https://user:pw@example.com', null))
  assert.ok('error' in checkTarget('file:///etc/passwd', '/home/me/proj'))
  assert.ok('error' in checkTarget('index.html', null))
  const ok = checkTarget('dist/index.html', '/home/me/proj')
  // Windows writes file addresses with a drive letter, so compare against what this computer would produce.
  assert.ok('url' in ok && ok.url === pathToFileURL(resolve('/home/me/proj', 'dist', 'index.html')).toString())
  assert.ok('error' in checkTarget('../secret.html', '/home/me/proj'))
  assert.ok('error' in checkTarget('/etc/passwd.html', '/home/me/proj'))
  assert.ok('error' in checkTarget('notes.txt', '/home/me/proj'))
  assert.ok('error' in checkTarget('', '/home/me/proj'))
})

function fake(replies: string[], opts: { problems?: string[][]; maxSteps?: number; maxMs?: number; clock?: () => number } = {}) {
  const done: QaAction[] = []
  const prompts: string[] = []
  let i = 0
  let p = 0
  return {
    done,
    prompts,
    driver: {
      goal: 'add a todo',
      maxSteps: opts.maxSteps,
      maxMs: opts.maxMs,
      now: opts.clock,
      shot: async () => 'SHOT',
      ask: async (prompt: string) => {
        prompts.push(prompt)
        return replies[Math.min(i++, replies.length - 1)]
      },
      perform: async (a: QaAction) => {
        done.push(a)
      },
      problems: () => (opts.problems ? opts.problems[Math.min(p++, opts.problems.length - 1)] : [])
    }
  }
}

test('runQa: performs steps until the model says done (pass)', async () => {
  const f = fake([
    '{"action":"click","x":100,"y":50}',
    '{"action":"type","text":"milk"}',
    '{"action":"key","key":"Enter"}',
    '{"action":"done","verdict":"pass","summary":"Todo was added","bugs":[]}'
  ])
  const r = await runQa(f.driver)
  assert.equal(r.verdict, 'pass')
  assert.equal(r.steps, 4)
  assert.equal(f.done.length, 3)
  assert.match(f.prompts[1], /click at 100,50/)
})

test('runQa: console errors are listed and mentioned, without changing the verdict', async () => {
  const f = fake(['{"action":"done","verdict":"pass","summary":"Looks fine","bugs":[]}'], { problems: [['TypeError: x is undefined']] })
  const r = await runQa(f.driver)
  assert.equal(r.verdict, 'pass')
  assert.deepEqual(r.problems, ['TypeError: x is undefined'])
  assert.match(r.summary, /1 problem/)
})

test('runQa: a fail verdict keeps the bugs; a stuck loop and the step limit end as unclear', async () => {
  const fail = await runQa(fake(['{"action":"done","verdict":"fail","summary":"Nothing happens","bugs":["Add button does nothing"]}']).driver)
  assert.equal(fail.verdict, 'fail')
  assert.deepEqual(fail.bugs, ['Add button does nothing'])
  const stuck = await runQa(fake(['{"action":"click","x":1,"y":1}']).driver)
  assert.equal(stuck.verdict, 'unclear')
  assert.match(stuck.summary, /stuck/)
  let n = 0
  const varied = fake([], { maxSteps: 3 })
  varied.driver.ask = async () => `{"action":"click","x":${n++},"y":1}`
  const limit = await runQa(varied.driver)
  assert.equal(limit.verdict, 'unclear')
  assert.match(limit.summary, /3 steps/)
})

test('runQa: bad replies are retried, then given up on', async () => {
  const ok = await runQa(fake(['I think click the button', '{"action":"done","verdict":"pass","summary":"ok","bugs":[]}']).driver)
  assert.equal(ok.verdict, 'pass')
  const bad = await runQa(fake(['nope']).driver)
  assert.equal(bad.verdict, 'unclear')
  assert.match(bad.summary, /stronger model/)
})

test('runQa: stop signal and time limit end the test', async () => {
  const c = new AbortController()
  c.abort()
  const stopped = await runQa({ ...fake(['{"action":"wait"}']).driver, signal: c.signal })
  assert.match(stopped.summary, /stopped/)
  let t = 0
  const slow = await runQa(fake(['{"action":"scroll","dy":10}', '{"action":"scroll","dy":20}', '{"action":"scroll","dy":30}'], { maxMs: 1000, clock: () => (t += 600) }).driver)
  assert.match(slow.summary, /out of time/)
})

test('reportText: gives a paste-ready write-up with bugs and page errors', () => {
  const t = reportText('add a todo', { verdict: 'fail', summary: 'Nothing happens.', bugs: ['Add does nothing'], steps: 3, problems: ['TypeError: x'] }, 'http://localhost:5173')
  assert.match(t, /found a problem/)
  assert.match(t, /- Add does nothing/)
  assert.match(t, /- TypeError: x/)
  assert.match(t, /fix it/)
})
