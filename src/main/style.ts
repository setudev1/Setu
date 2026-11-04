// Reply language and teaching mode. These only add instructions to the prompt; the model does the rest.
export type Language = 'en' | 'hi' | 'gu' | 'hinglish'
export const LANGUAGES: Language[] = ['en', 'hi', 'gu', 'hinglish']

export type Style = { language: Language; explain: boolean; name: string; callMe: string; learned: string[] }

export const LEARNED_MAX = 20

/** Short one-line preferences the user taught Setu. Control characters and line breaks are removed. */
export function cleanLearned(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((x): x is string => typeof x === 'string')
    // eslint-disable-next-line no-control-regex
    .map((x) => x.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160))
    .filter(Boolean)
    .slice(-LEARNED_MAX)
}

// A name or a nickname: letters, numbers, spaces and a few marks only, so nothing can pose as an instruction.
export function cleanName(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function parseStyle(value: unknown): Style {
  const v = (value ?? {}) as { language?: unknown; explain?: unknown; name?: unknown; callMe?: unknown; learned?: unknown }
  const language = LANGUAGES.includes(v.language as Language) ? (v.language as Language) : 'en'
  return { language, explain: v.explain === true, name: cleanName(v.name, 40), callMe: cleanName(v.callMe, 24), learned: cleanLearned(v.learned) }
}

export function buildStyle(style: Style): string | undefined {
  const parts: string[] = []
  // How to address the user: their chosen title if they picked one, otherwise their name.
  if (style.callMe) {
    parts.push(
      `The user wants to be called "${style.callMe}"${style.name ? ` (their name is ${style.name})` : ''}. ` +
        `Address them that way now and then, for example in a greeting or a closing line, not in every sentence. ` +
        `Never put it inside code, file contents or the "FILE:" lines.`
    )
  } else if (style.name) {
    parts.push(
      `The user's name is ${style.name}. Call them by name now and then, for example in a greeting or a closing line, ` +
        `not in every sentence. Never put it inside code, file contents or the "FILE:" lines.`
    )
  }
  if (style.learned && style.learned.length > 0) {
    parts.push(
      `The user has taught Setu these preferences from earlier chats. Follow them unless the user asks for something different now:\n${style.learned.map((l) => `- ${l}`).join('\n')}`
    )
  }
  if (style.language === 'hi') {
    parts.push('Write all explanations in Hindi (Devanagari script).')
  } else if (style.language === 'gu') {
    parts.push('Write all explanations in Gujarati (Gujarati script).')
  } else if (style.language === 'hinglish') {
    parts.push('Write all explanations in Hinglish: Hindi written in English letters, the way people text.')
  }
  if (style.language !== 'en') {
    parts.push(
      'Keep code, file names, commands and technical terms in English, and keep the "FILE:" lines exactly in English.'
    )
  }
  if (style.explain) {
    parts.push(
      'Teaching mode: after the code, explain in simple words what each change does and why, as if to a beginner. ' +
        'Keep it short, and avoid jargon or explain it when you must use it.'
    )
  }
  return parts.length ? parts.join(' ') : undefined
}
