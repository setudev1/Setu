// A small, private meter of how many tokens cloud models used this month. It never leaves this computer.
export type Usage = { month: string; byModel: Record<string, { input: number; output: number }> }

const KEY = 'setu.usage'
const CAP_KEY = 'setu.usageCap'
const thisMonth = (): string => new Date().toISOString().slice(0, 7)

export function loadUsage(): Usage {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && v.month === thisMonth() && v.byModel && typeof v.byModel === 'object') return v as Usage
  } catch {
    /* start fresh */
  }
  return { month: thisMonth(), byModel: {} }
}

export function addUsage(model: string, input = 0, output = 0): Usage {
  const u = loadUsage()
  const cur = u.byModel[model] ?? { input: 0, output: 0 }
  u.byModel[model] = { input: cur.input + (input || 0), output: cur.output + (output || 0) }
  try {
    localStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
  return u
}

export const totalTokens = (u: Usage): number =>
  Object.values(u.byModel).reduce((a, m) => a + m.input + m.output, 0)

export function loadCap(): number {
  try {
    const n = Number(localStorage.getItem(CAP_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function saveCap(n: number): void {
  try {
    localStorage.setItem(CAP_KEY, String(Math.max(0, Math.floor(n))))
  } catch {
    /* ignore */
  }
}

export const formatTokens = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
