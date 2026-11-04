import test from 'node:test'
import assert from 'node:assert/strict'
import { contextNotice, estimateTokens, fitHistory, historyBudget, LOCAL_WINDOW } from '../src/main/context'
import type { ChatMessage } from '../src/main/ollama'

const msg = (role: 'user' | 'assistant', chars: number, images?: string[]): ChatMessage => ({ role, content: 'x'.repeat(chars), ...(images ? { images } : {}) })

test('estimateTokens: about 4 characters per token', () => {
  assert.equal(estimateTokens(''), 4)
  assert.equal(estimateTokens('a'.repeat(400)), 104)
})

test('historyBudget: local models get the 8,192 window minus instructions and reply room; cloud gets a fixed history', () => {
  const local = historyBudget('qwen2.5-coder:7b', 3500)
  assert.equal(local.limit, LOCAL_WINDOW)
  assert.equal(local.budget, LOCAL_WINDOW - 1500 - 3500)
  assert.equal(historyBudget('api:openai:gpt', 3500).budget, 24000)
  assert.equal(historyBudget('or:vendor/model', 100).budget, 24000)
  assert.equal(historyBudget('glm-5.3-flash:cloud', 100).budget, 16000)
  // a huge instruction block still leaves room for the newest message
  assert.equal(historyBudget('llama3.2:3b', 9000).budget, 1000)
})

test('fitHistory: a short chat is untouched', () => {
  const chat = [msg('user', 400), msg('assistant', 800), msg('user', 200)]
  const f = fitHistory(chat, 3000, 3000, 8192)
  assert.equal(f.dropped, 0)
  assert.equal(f.messages.length, 3)
})

test('fitHistory: drops the oldest messages first and starts with a user message', () => {
  const chat = [msg('user', 4000), msg('assistant', 4000), msg('user', 4000), msg('assistant', 4000), msg('user', 400)]
  const f = fitHistory(chat, 2600, 3000, 8192)
  assert.equal(f.messages[0].role, 'user')
  assert.equal(f.messages[f.messages.length - 1].content.length, 400)
  assert.ok(f.dropped >= 2)
  assert.equal(f.messages.length, chat.length - f.dropped)
})

test('fitHistory: always keeps the newest message, even when it alone is too big', () => {
  const f = fitHistory([msg('user', 100), msg('assistant', 100), msg('user', 40000)], 500, 3000, 8192)
  assert.equal(f.messages.length, 1)
  assert.equal(f.messages[0].content.length, 40000)
})

test('fitHistory: pictures count toward the budget', () => {
  const withPic = [msg('user', 100, ['a', 'b']), msg('assistant', 100), msg('user', 100)]
  assert.ok(fitHistory(withPic, 600, 0, 8192).dropped >= 2)
  assert.equal(fitHistory(withPic, 5000, 0, 8192).dropped, 0)
})

test('contextNotice: says what was dropped, warns when nearly full on local, and is quiet otherwise', () => {
  assert.match(contextNotice({ messages: [], dropped: 3, used: 100, limit: 8192 }, true) ?? '', /oldest 3 messages/)
  assert.match(contextNotice({ messages: [], dropped: 1, used: 100, limit: 8192 }, false) ?? '', /oldest 1 message to/)
  assert.match(contextNotice({ messages: [], dropped: 0, used: 7000, limit: 8192 }, true) ?? '', /nearly filling/)
  assert.equal(contextNotice({ messages: [], dropped: 0, used: 7000, limit: 8192 }, false), null)
  assert.equal(contextNotice({ messages: [], dropped: 0, used: 1000, limit: 8192 }, true), null)
})

test('small laptops get a smaller memory window', async () => {
  const { localWindow, LOCAL_WINDOW } = await import('../src/main/context')
  assert.equal(localWindow(8 * 1024 ** 3), LOCAL_WINDOW)
  assert.equal(localWindow(16 * 1024 ** 3), 12288)
  assert.equal(localWindow(32 * 1024 ** 3), 16384)
})
