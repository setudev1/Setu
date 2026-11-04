import { useState } from 'react'
import { stripThink } from '../lib/think'

type Part = { type: 'text' | 'code'; value: string; lang?: string }

// Splits a reply into normal text and ``` code blocks. Works while the reply is still streaming.
export function splitParts(text: string): Part[] {
  const parts: Part[] = []
  const re = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    parts.push({ type: 'code', lang: m[1].trim(), value: m[2] })
    last = re.lastIndex
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

function CodeBlock({ lang, value }: { lang?: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang || 'code'}</span>
        <button
          className="code-copy"
          onClick={() => {
            void navigator.clipboard.writeText(value.replace(/\n$/, ''))
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </div>
  )
}

export default function MessageBody({ text }: { text: string }) {
  return (
    <>
      {splitParts(stripThink(text)).map((p, i) =>
        p.type === 'code' ? (
          <CodeBlock key={i} lang={p.lang} value={p.value} />
        ) : (
          <p key={i} className="text-part">
            {p.value}
          </p>
        )
      )}
    </>
  )
}
