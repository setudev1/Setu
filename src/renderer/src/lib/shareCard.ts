// "Share my build": a picture people can post. It holds the project name, a screenshot of the preview, and Setu's
// name. Everything is drawn on this computer; nothing is uploaded.
export const CARD_W = 1080
export const CARD_H = 1350

export function shortName(name: string, max = 26): string {
  const t = (name || 'my project').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'my project'
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const k = size / 330
  ctx.save()
  ctx.translate(x - 76 * k, y - 100 * k)
  ctx.scale(k, k)
  const g = ctx.createLinearGradient(96, 400, 416, 120)
  g.addColorStop(0, '#5fd3a3')
  g.addColorStop(1, '#7a9cff')
  ctx.fillStyle = g
  ctx.fill(new Path2D('M96 372V272A160 160 0 0 1 416 272V372H360V272A104 104 0 0 0 152 272V372Z'))
  ctx.globalAlpha = 0.75
  ctx.fill(new Path2D('M176 372V272A80 80 0 0 1 336 272V372H296V272A40 40 0 0 0 216 272V372Z'))
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fff'
  ctx.fill(new Path2D('M240 372V272A16 16 0 0 1 272 272V372Z'))
  ctx.restore()
}

/** Draws the card. `shot` is the preview picture (or null, then a plain frame is drawn). */
export function drawCard(ctx: CanvasRenderingContext2D, name: string, shot: CanvasImageSource | null, shotSize?: { w: number; h: number }): void {
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  bg.addColorStop(0, '#05080b')
  bg.addColorStop(1, '#0b1018')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  for (const [cx, cy, c] of [[180, 220, '95,211,163'], [920, 1120, '122,156,255']] as const) {
    const r = ctx.createRadialGradient(cx, cy, 0, cx, cy, 620)
    r.addColorStop(0, `rgba(${c},0.30)`)
    r.addColorStop(1, `rgba(${c},0)`)
    ctx.fillStyle = r
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  }
  drawLogo(ctx, 70, 66, 78)
  ctx.fillStyle = '#eceef1'
  ctx.font = '800 44px "IBM Plex Sans", Inter, "Segoe UI", sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Setu', 168, 122)

  ctx.fillStyle = '#9097a1'
  ctx.font = '500 34px "IBM Plex Sans", Inter, "Segoe UI", sans-serif'
  ctx.fillText('I just built', 70, 230)
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 76px "IBM Plex Sans", Inter, "Segoe UI", sans-serif'
  ctx.fillText(shortName(name), 70, 312)

  // the screenshot, inside a rounded frame
  const fx = 70, fy = 360, fw = CARD_W - 140, fh = 700
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  roundRect(ctx, fx, fy, fw, fh, 34)
  ctx.fillStyle = '#11161c'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, fx, fy, fw, fh, 34)
  ctx.clip()
  if (shot && shotSize && shotSize.w > 0 && shotSize.h > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(fx, fy, fw, fh)
    const s = Math.min(fw / shotSize.w, fh / shotSize.h)
    const w = shotSize.w * s, h = shotSize.h * s
    ctx.drawImage(shot, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h)
  } else {
    drawLogo(ctx, CARD_W / 2 - 110, fy + fh / 2 - 100, 220)
  }
  ctx.restore()
  roundRect(ctx, fx, fy, fw, fh, 34)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = '#5fd3a3'
  ctx.font = '700 44px "IBM Plex Sans", Inter, "Segoe UI", sans-serif'
  ctx.fillText('Built with Setu', 70, 1150)
  ctx.fillStyle = '#c7ccd3'
  ctx.font = '500 32px "IBM Plex Sans", Inter, "Segoe UI", sans-serif'
  ctx.fillText('Free AI coding that runs on my own computer.', 70, 1204)
  ctx.fillStyle = '#6c7480'
  ctx.font = '500 28px "IBM Plex Mono", "Consolas", monospace'
  ctx.fillText('github.com/setudev1/Setu   #MadeWithSetu', 70, 1262)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Could not read the picture.'))
    i.src = src
  })
}

/** Makes the PNG. `shotDataUrl` is a screenshot of the preview, or null. */
export async function makeShareCard(name: string, shotDataUrl: string | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This computer cannot draw the picture.')
  let img: HTMLImageElement | null = null
  if (shotDataUrl) {
    try {
      img = await loadImage(shotDataUrl)
    } catch {
      img = null
    }
  }
  drawCard(ctx, name, img, img ? { w: img.naturalWidth, h: img.naturalHeight } : undefined)
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not save the picture.'))), 'image/png'))
}
