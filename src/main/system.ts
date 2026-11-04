// Basic facts about this computer, used to suggest a model that fits. Nothing is sent anywhere.
import * as os from 'os'
import { promises as fs } from 'fs'

export type SystemInfo = { ramGB: number; freeDiskGB: number | null }

export async function getSystemInfo(): Promise<SystemInfo> {
  const ramGB = Math.round((os.totalmem() / 1024 ** 3) * 10) / 10
  let freeDiskGB: number | null = null
  try {
    const s = await fs.statfs(os.homedir())
    freeDiskGB = Math.round(((Number(s.bavail) * Number(s.bsize)) / 1024 ** 3) * 10) / 10
  } catch {
    /* some systems can't report free space; the interface then skips the disk warning */
  }
  return { ramGB, freeDiskGB }
}
