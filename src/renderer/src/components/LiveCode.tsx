import { useEffect, useRef } from 'react'

type Kind = 'dot' | 'glyph' | 'file'
type Node = { x: number; y: number; vx: number; vy: number; label: string; kind: Kind; r: number }
type Ripple = { x: number; y: number; r: number; a: number; color: string }

const GLYPHS = ['{ }', '( )', '[ ]', '=>', '</>', '&&', '||', '==', ';', '//', 'fn', 'if', '0', '1', 'let', '++', '::', '#']

const base = (p: string): string => p.split('/').pop() ?? p

/**
 * A live wallpaper made of drifting code symbols and the names of your own project files.
 * - The mouse pushes them aside and lights up the ones near it.
 * - While Setu is writing a reply it speeds up and glows in the accent colour.
 * - A finished Run sends a green (worked) or red (failed) ripple across the screen.
 */
export default function LiveCode({ busy, words, paused }: { busy: boolean; words: string[]; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  const pausedRef = useRef(paused)
  const nodes = useRef<Node[]>([])
  const mouse = useRef<{ x: number; y: number } | null>(null)
  const ripples = useRef<Ripple[]>([])
  busyRef.current = busy
  pausedRef.current = paused

  useEffect(() => {
    if (ref.current) ref.current.dataset.mode = busy ? 'busy' : 'idle'
  }, [busy])

  // Rebuild the floating things when the project's files change.
  const key = words.join('|')
  useEffect(() => {
    const w = ref.current?.clientWidth || window.innerWidth
    const h = ref.current?.clientHeight || window.innerHeight
    const files = words.slice(0, 14).map(base)
    const list: Node[] = []
    const add = (kind: Kind, label: string, r: number): void => {
      const a = Math.random() * Math.PI * 2
      const sp = 0.12 + Math.random() * 0.22
      list.push({ x: Math.random() * w, y: Math.random() * h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, label, kind, r })
    }
    for (let i = 0; i < 26; i++) add('dot', '', 1.4 + Math.random() * 1.6)
    for (let i = 0; i < 20; i++) add('glyph', GLYPHS[i % GLYPHS.length], 0)
    files.forEach((f) => add('file', f, 0))
    nodes.current = list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let raf = 0
    let alive = true
    let speed = 1
    let accent = '#5fd3a3'
    let lastAccent = 0

    const resize = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const move = (e: MouseEvent): void => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    const leave = (): void => {
      mouse.current = null
    }
    const pulse = (e: Event): void => {
      const ok = (e as CustomEvent<string>).detail === 'ok'
      ripples.current.push({ x: canvas.width / 2, y: canvas.height / 2, r: 0, a: 0.5, color: ok ? '#5fd3a3' : '#f27a9b' })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseout', leave)
    window.addEventListener('setu:pulse', pulse)

    const draw = (now: number): void => {
      if (!alive) return
      if (pausedRef.current) {
        raf = window.setTimeout(() => draw(performance.now()), 400) as unknown as number
        return
      }
      if (now - lastAccent > 1000) {
        accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent
        lastAccent = now
      }
      const w = canvas.width
      const h = canvas.height
      const b = busyRef.current
      speed += ((still ? 0 : b ? 2.6 : 1) - speed) * 0.05
      ctx.clearRect(0, 0, w, h)
      const m = mouse.current
      const ns = nodes.current
      const glow: number[] = new Array(ns.length).fill(0)

      for (let i = 0; i < ns.length; i++) {
        const n = ns[i]
        n.x += n.vx * speed
        n.y += n.vy * speed
        if (n.x < -80) n.x = w + 60
        else if (n.x > w + 80) n.x = -60
        if (n.y < -20) n.y = h + 20
        else if (n.y > h + 20) n.y = -20
        if (m) {
          const dx = n.x - m.x
          const dy = n.y - m.y
          const d = Math.hypot(dx, dy)
          if (d < 160 && d > 0.1) {
            const f = (160 - d) / 160
            n.x += (dx / d) * f * 2.2
            n.y += (dy / d) * f * 2.2
            glow[i] = f
          }
        }
      }

      // Thin lines between nearby things, brighter while Setu is working.
      ctx.lineWidth = 1
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y)
          if (d < 130) {
            ctx.globalAlpha = (1 - d / 130) * (b ? 0.34 : 0.14)
            ctx.strokeStyle = b ? accent : '#ffffff'
            ctx.beginPath()
            ctx.moveTo(ns[i].x, ns[i].y)
            ctx.lineTo(ns[j].x, ns[j].y)
            ctx.stroke()
          }
        }
        if (m && glow[i] > 0) {
          ctx.globalAlpha = glow[i] * 0.45
          ctx.strokeStyle = accent
          ctx.beginPath()
          ctx.moveTo(ns[i].x, ns[i].y)
          ctx.lineTo(m.x, m.y)
          ctx.stroke()
        }
      }

      ctx.textBaseline = 'middle'
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i]
        const hot = glow[i] > 0.05
        ctx.fillStyle = hot || b ? accent : '#ffffff'
        if (n.kind === 'dot') {
          ctx.globalAlpha = Math.min(1, 0.32 + glow[i] * 0.6 + (b ? 0.2 : 0))
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r + glow[i] * 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.font = n.kind === 'file' ? '12.5px "IBM Plex Mono", Consolas, monospace' : '13px "IBM Plex Mono", Consolas, monospace'
          ctx.globalAlpha = Math.min(1, (n.kind === 'file' ? 0.34 : 0.22) + glow[i] * 0.65 + (b ? 0.18 : 0))
          ctx.fillText(n.label, n.x, n.y)
        }
      }

      // Ripples from a finished Run.
      ripples.current = ripples.current.filter((r) => r.a > 0.01)
      for (const r of ripples.current) {
        r.r += 7
        r.a *= 0.965
        ctx.globalAlpha = r.a
        ctx.strokeStyle = r.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseout', leave)
      window.removeEventListener('setu:pulse', pulse)
    }
  }, [])

  return <canvas ref={ref} className="wp-live" data-mode="idle" />
}
