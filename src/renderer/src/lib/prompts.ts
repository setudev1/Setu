// Slash commands: type "/" in the message box to insert a ready prompt. Users can add their own.
export type SavedPrompt = { name: string; text: string; builtin?: boolean }

export const BUILTIN_PROMPTS: SavedPrompt[] = [
  { name: 'fix', text: 'I have a bug. Here is what happens and what I expected: ', builtin: true },
  { name: 'explain', text: 'Explain this code to me in simple words, step by step: ', builtin: true },
  { name: 'tests', text: 'Write simple tests for this code: ', builtin: true },
  { name: 'comments', text: 'Add short, helpful comments to this code: ', builtin: true },
  { name: 'pretty', text: 'Make this page look cleaner and more modern: ', builtin: true },
  { name: 'simplify', text: 'Make this code simpler and shorter without changing what it does: ', builtin: true },
  { name: 'review', text: 'Review this code like a careful teammate. List bugs, risks and easy improvements, most important first: ', builtin: true },
  { name: 'loop', text: '/loop 10m ', builtin: true },
  { name: 'secure', text: 'Check this code for security problems (secrets in code, unsafe input, risky libraries) and tell me how to fix each one: ', builtin: true }
]

const KEY = 'setu.prompts'
export const cleanPromptName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20)

export function loadCustomPrompts(): SavedPrompt[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((p) => p && typeof p.name === 'string' && typeof p.text === 'string')
      .map((p) => ({ name: cleanPromptName(p.name), text: String(p.text).slice(0, 2000) }))
      .filter((p) => p.name && p.text.trim())
      .slice(0, 50)
  } catch {
    return []
  }
}

export function saveCustomPrompts(list: SavedPrompt[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ name, text }) => ({ name, text }))))
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new Event('setu:prompts'))
}

/** Own prompts win over built-in ones with the same name. */
export function allPrompts(): SavedPrompt[] {
  const mine = loadCustomPrompts()
  const names = new Set(mine.map((p) => p.name))
  return [...mine, ...BUILTIN_PROMPTS.filter((p) => !names.has(p.name))]
}
