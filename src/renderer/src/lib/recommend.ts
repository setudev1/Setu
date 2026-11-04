// Picks which local model to suggest first, based on how much memory the computer has.
export type Pick = { name: string; title: string; sizeGB: number; why: string }

export const QUICK: Pick = {
  name: 'qwen2.5-coder:1.5b',
  title: 'Quick start',
  sizeGB: 1,
  why: 'Small and fast. Works on almost any computer, but writes simpler code.'
}
export const BETTER: Pick = {
  name: 'qwen2.5-coder:7b',
  title: 'Better quality',
  sizeGB: 4.7,
  why: 'Writes noticeably better code. Wants about 8 GB of memory or more.'
}

export type Recommendation = { primary: Pick; alternative: Pick | null }

export function recommend(ramGB: number | null): Recommendation {
  if (ramGB !== null && ramGB >= 16) return { primary: BETTER, alternative: QUICK }
  if (ramGB !== null && ramGB >= 8) return { primary: QUICK, alternative: BETTER }
  return { primary: QUICK, alternative: null }
}

/** A warning if the download might not fit, or null if all is fine or unknown. */
export function diskWarning(freeDiskGB: number | null, sizeGB: number): string | null {
  if (freeDiskGB === null) return null
  const needed = sizeGB + 1
  if (freeDiskGB < needed) {
    return `Only about ${freeDiskGB} GB is free on your drive, and this needs about ${needed} GB. Free some space first, or use a cloud model.`
  }
  return null
}

export type Fit = 'good' | 'slow' | 'toobig' | 'unknown'

/** Rough rule: a model needs about 1.3 times its file size in memory. Comfortable up to 60% of the computer's memory. */
export function fitFor(sizeGB: number, ramGB: number | null): Fit {
  if (ramGB === null || !(sizeGB > 0)) return 'unknown'
  const need = sizeGB * 1.3
  if (need <= ramGB * 0.6) return 'good'
  if (need <= ramGB * 0.9) return 'slow'
  return 'toobig'
}

export const FIT_TEXT: Record<Fit, string> = {
  good: 'Runs well on this computer',
  slow: 'May be slow on this computer',
  toobig: 'Too big for this computer. Use a cloud model instead',
  unknown: ''
}

/** "~4.7 GB" to 4.7. Returns 0 when there is no number. */
export const parseSizeGB = (s: string): number => {
  const m = /([\d.]+)\s*GB/i.exec(s)
  return m ? Number(m[1]) : 0
}
