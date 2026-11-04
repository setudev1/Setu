// Thinking models may write their reasoning between <think> tags. Hide it, and say "Thinking…" while it is still being written.
export function stripThink(text: string): string {
  const done = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '')
  const open = done.indexOf('<think>')
  if (open < 0) return done
  return done.slice(0, open) + (done.slice(0, open).trim() ? '' : '_Thinking…_')
}
