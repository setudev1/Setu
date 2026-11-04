// Loop: repeat one prompt every few minutes while Setu is open. Type "/loop 10m check my tests" and "/loop stop".
export const LOOP_MAX_RUNS = 10
export const LOOP_MIN_MIN = 1
export const LOOP_MAX_MIN = 240

export type LoopCmd = { kind: 'start'; everyMin: number; prompt: string } | { kind: 'stop' } | { kind: 'bad'; reason: string }

export function parseLoop(text: string): LoopCmd | null {
  const t = text.trim()
  if (!/^\/loop(\s|$)/i.test(t)) return null
  const rest = t.slice(5).trim()
  if (/^stop$/i.test(rest)) return { kind: 'stop' }
  const m = /^(\d{1,3})\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\s+([\s\S]+)$/i.exec(rest)
  if (!m) return { kind: 'bad', reason: 'Type it like this: /loop 10m check my tests (use m for minutes or h for hours). To stop: /loop stop.' }
  const n = Number(m[1])
  const everyMin = /^h/i.test(m[2]) ? n * 60 : n
  if (everyMin < LOOP_MIN_MIN || everyMin > LOOP_MAX_MIN) return { kind: 'bad', reason: `Pick a time between ${LOOP_MIN_MIN} minute and ${LOOP_MAX_MIN / 60} hours.` }
  const prompt = m[3].trim().slice(0, 2000)
  if (!prompt) return { kind: 'bad', reason: 'Add what Setu should do each time.' }
  return { kind: 'start', everyMin, prompt }
}

export const everyLabel = (min: number): string => (min % 60 === 0 ? `${min / 60}h` : `${min}m`)
