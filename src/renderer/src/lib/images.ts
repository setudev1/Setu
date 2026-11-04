// Turns a picked or pasted picture into a smaller JPEG, so it is quick to send and easy for a model to read.
export type Attached = { dataUrl: string; base64: string }

export const MAX_IMAGES = 3
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_SIDE = 1600

export async function fileToAttached(file: File): Promise<Attached> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a picture (png, jpg or webp).')
  if (file.size > MAX_FILE_BYTES) throw new Error('That picture is too big. Please use one under 15 MB.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that picture.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
