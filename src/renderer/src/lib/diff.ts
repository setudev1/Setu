// A small line-by-line diff, used to show what a change will do before it is saved.
export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }
export type DiffItem = DiffLine | { type: 'gap'; count: number }

const MAX_CELLS = 4_000_000

export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const head: DiffLine[] = a.slice(0, start).map((text) => ({ type: 'same', text }))
  const tail: DiffLine[] = a.slice(endA).map((text) => ({ type: 'same', text }))
  const ma = a.slice(start, endA)
  const mb = b.slice(start, endB)

  let middle: DiffLine[] = []
  if (ma.length * mb.length > MAX_CELLS) {
    middle = [
      ...ma.map((text): DiffLine => ({ type: 'del', text })),
      ...mb.map((text): DiffLine => ({ type: 'add', text }))
    ]
  } else {
    const n = ma.length
    const m = mb.length
    const w = m + 1
    const dp = new Uint32Array((n + 1) * w)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] =
          ma[i] === mb[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (ma[i] === mb[j]) {
        middle.push({ type: 'same', text: ma[i] })
        i++
        j++
      } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
        middle.push({ type: 'del', text: ma[i++] })
      } else {
        middle.push({ type: 'add', text: mb[j++] })
      }
    }
    while (i < n) middle.push({ type: 'del', text: ma[i++] })
    while (j < m) middle.push({ type: 'add', text: mb[j++] })
  }
  return [...head, ...middle, ...tail]
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.type === 'add') added++
    else if (l.type === 'del') removed++
  }
  return { added, removed }
}

/** Hides long unchanged stretches, keeping a few lines of context around each change. */
export function collapse(lines: DiffLine[], context = 3): DiffItem[] {
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((l, i) => {
    if (l.type !== 'same') {
      for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true
    }
  })
  const out: DiffItem[] = []
  let gap = 0
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (gap > 0) out.push({ type: 'gap', count: gap })
      gap = 0
      out.push(l)
    } else gap++
  })
  if (gap > 0) out.push({ type: 'gap', count: gap })
  return out
}
