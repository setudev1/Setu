// Finds things that look like API keys, tokens and passwords, so Setu can warn before they are sent or saved.
// This is a best-effort check: it catches common key formats, not every possible secret.

export type SecretFinding = { kind: string; start: number; end: number }

const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { kind: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'OpenAI-style key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/g },
  { kind: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g },
  { kind: 'AWS access key', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'login token (JWT)', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  {
    kind: 'password or secret',
    re: /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[^\s"']{8,}/gi
  }
]

export function findSecrets(text: string): SecretFinding[] {
  const found: SecretFinding[] = []
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      const start = m.index
      const end = start + m[0].length
      // Skip a match that sits inside one we already have (an "sk-ant-" key also matches the OpenAI pattern).
      if (!found.some((f) => start < f.end && end > f.start)) found.push({ kind, start, end })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

export function secretKinds(findings: SecretFinding[]): string[] {
  return [...new Set(findings.map((f) => f.kind))]
}

/** Replaces each secret with a marker. Used before a conversation is saved to disk. */
export function redactSecrets(text: string): string {
  const findings = findSecrets(text)
  if (findings.length === 0) return text
  let out = ''
  let pos = 0
  for (const f of findings) {
    out += text.slice(pos, f.start) + `[hidden ${f.kind}]`
    pos = f.end
  }
  return out + text.slice(pos)
}
