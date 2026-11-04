// Titles offered at first run and in Settings. An empty value means "just use my name".
export const CALL_OPTIONS: { value: string; label: string }[] = [
  { value: 'Sir', label: 'Sir' },
  { value: 'Madam', label: 'Madam' },
  { value: 'Buddy', label: 'Buddy' },
  { value: 'Boss', label: 'Boss' },
  { value: 'Friend', label: 'Friend' },
  { value: '', label: 'Just my name' }
]

/** What Setu says on the home screen. */
export function greetingName(userName: string, callMe: string): string {
  return callMe || userName
}

export function cleanInput(value: string, max: number): string {
  return value.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').slice(0, max)
}
