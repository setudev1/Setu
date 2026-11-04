// "Setu learns from you": short preferences saved on this computer and added to every chat.
// The model itself is not retrained. Setu remembers what you liked and what you did not, and tells the model each time.
const KEY = 'setu.learned'
export const LEARNED_MAX = 20

export const cleanRule = (s: string): string => s.replace(/\s+/g, ' ').trim().slice(0, 160)

export function loadLearned(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').map(cleanRule).filter(Boolean).slice(-LEARNED_MAX) : []
  } catch {
    return []
  }
}

export function saveLearned(list: string[]): string[] {
  const clean = list.map(cleanRule).filter(Boolean)
  const seen = new Set<string>()
  const unique = clean.filter((r) => (seen.has(r.toLowerCase()) ? false : (seen.add(r.toLowerCase()), true))).slice(-LEARNED_MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(unique))
  } catch {
    /* storage can be blocked */
  }
  return unique
}

export function addLearned(rule: string): string[] {
  const r = cleanRule(rule)
  return r ? saveLearned([...loadLearned(), r]) : loadLearned()
}
