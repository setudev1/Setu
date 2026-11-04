import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_LOCAL, CLOUD_CATALOG, GROUPS, isCataloged } from '../src/renderer/src/lib/catalog'
import { isValidModelName, VISION_NAME_RE } from '../src/main/ollama'
import { parseSizeGB } from '../src/renderer/src/lib/recommend'
import { stripThink } from '../src/renderer/src/lib/think'

test('catalog: names are unique and valid, sizes can be read, every model has a note', () => {
  const names = [...ALL_LOCAL, ...CLOUD_CATALOG].map((m) => m.name)
  assert.equal(new Set(names).size, names.length)
  for (const m of ALL_LOCAL) {
    assert.ok(isValidModelName(m.name), m.name)
    assert.ok(parseSizeGB(m.size) > 0, `${m.name} size`)
    assert.ok(m.note.length > 10 && m.title.length > 2)
  }
  for (const m of CLOUD_CATALOG) assert.ok(/[:-]cloud$/.test(m.name))
})

test('catalog: groups are sorted by work and there are at least 10 more models than before', () => {
  assert.deepEqual(GROUPS.map((g) => g.id), ['coding', 'thinking', 'vision', 'everyday', 'tiny'])
  assert.ok(ALL_LOCAL.length >= 6 + 10)
  for (const g of GROUPS) assert.ok(g.models.length >= 2, g.id)
})

test('catalog: every vision model is recognised as able to read pictures, and no other group is', () => {
  const vision = GROUPS.find((g) => g.id === 'vision')!
  for (const m of vision.models) assert.ok(VISION_NAME_RE.test(m.name), m.name)
  for (const g of GROUPS.filter((x) => x.id !== 'vision' && x.id !== 'everyday'))
    for (const m of g.models) assert.ok(!VISION_NAME_RE.test(m.name), m.name)
})

test('catalog: small models come first in each group and sizes only grow', () => {
  for (const g of GROUPS) {
    const sizes = g.models.map((m) => parseSizeGB(m.size))
    for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] >= sizes[i - 1], `${g.id}: ${g.models[i].name}`)
  }
  assert.equal(isCataloged('qwen3:8b'), true)
  assert.equal(isCataloged('my-own-model'), false)
})

test('stripThink: hides reasoning, shows Thinking while it is open, keeps normal text', () => {
  assert.equal(stripThink('<think>hmm\nlet me see</think>\nHere is the fix'), 'Here is the fix')
  assert.equal(stripThink('<think>still going'), '_Thinking…_')
  assert.equal(stripThink('Answer first <think>aside'), 'Answer first ')
  assert.equal(stripThink('no tags here'), 'no tags here')
})
