import { useEffect, useRef, useState } from 'react'
import type { WallpaperState } from '../types'
import LiveCode from './LiveCode'
import './wallpaper.css'

type BatteryLike = { charging: boolean; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }

/** The background layer. Video pauses when Setu is hidden, and optionally when the laptop is on battery. */
/** Average brightness (0 dark .. 1 bright) of an image or video frame, or null if it cannot be read. */
function sampleBrightness(el: CanvasImageSource): number | null {
  try {
    const W = 32
    const H = 18
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(el, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const vals: number[] = []
    for (let i = 0; i < d.length; i += 4) vals.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255)
    vals.sort((a, b) => a - b)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const p90 = vals[Math.floor(vals.length * 0.9)]
    return 0.6 * mean + 0.4 * p90 // bright spots matter too, because text can land on them
  } catch {
    return null
  }
}

export default function Wallpaper({ wp, scene, pauseOnBattery, busy = false, words = [], fast = false, light = false }: { wp: WallpaperState | null; scene?: string; pauseOnBattery: boolean; busy?: boolean; words?: string[]; fast?: boolean; light?: boolean }) {
  const [tone, setTone] = useState<number | null>(null)

  // Measure the chosen picture or video once, so text stays readable on bright or busy wallpapers.
  useEffect(() => {
    setTone(null)
    const root = document.documentElement
    if (!wp?.url) {
      delete root.dataset.wpTone
      return
    }
    let dead = false
    const done = (v: number | null): void => {
      if (dead) return
      setTone(v)
      root.dataset.wpTone = v !== null && v > 0.55 ? 'bright' : 'normal'
    }
    if (wp.kind === 'video') {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.preload = 'auto'
      v.onloadeddata = () => done(sampleBrightness(v))
      v.onerror = () => done(null)
      v.src = wp.url
    } else {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => done(sampleBrightness(im))
      im.onerror = () => done(null)
      im.src = wp.url
    }
    return () => {
      dead = true
    }
  }, [wp?.url, wp?.kind])

  // How much extra shade the picture needs for text to read well. Unknown brightness gets a gentle default.
  const auto = !wp?.url
    ? 0
    : tone === null
      ? 0.28
      : light
        ? Math.min(0.62, Math.max(0, (0.82 - tone) * 0.9))
        : Math.min(0.62, Math.max(0, (tone - 0.18) * 0.9))

  const videoRef = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let battery: BatteryLike | null = null
    let alive = true
    const update = (): void => {
      if (!alive) return
      setPaused(document.hidden || (pauseOnBattery && battery !== null && battery.charging === false))
    }
    document.addEventListener('visibilitychange', update)
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }
    if (pauseOnBattery && nav.getBattery) {
      nav
        .getBattery()
        .then((b) => {
          battery = b
          b.addEventListener('chargingchange', update)
          update()
        })
        .catch(() => undefined)
    }
    update()
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', update)
      battery?.removeEventListener('chargingchange', update)
    }
  }, [pauseOnBattery])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (paused) v.pause()
    else void v.play().catch(() => undefined)
  }, [paused, wp?.url])

  const blur = wp?.blur ?? 0
  const mediaStyle = blur > 0 ? { filter: `blur(${blur}px)`, transform: 'scale(1.06)' } : undefined

  return (
    <div className="wallpaper" aria-hidden="true">
      {!wp?.url && scene && <div className={`wp-scene scene-${scene}${paused ? ' paused' : ''}`} />}
      {!wp?.url && scene === 'live' && !fast && <LiveCode busy={busy} words={words} paused={paused} />}
      {wp?.url && wp.kind === 'image' && <img className="wp-media" src={wp.url} style={mediaStyle} alt="" draggable={false} />}
      {wp?.url && wp.kind === 'video' && (
        <video ref={videoRef} className="wp-media" src={wp.url} style={mediaStyle} autoPlay loop muted playsInline />
      )}
      {wp?.url && <div className="wp-scrim" style={{ opacity: auto }} />}
      {wp?.url && <div className="wp-dim" style={{ opacity: wp.dim }} />}
    </div>
  )
}
