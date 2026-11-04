// Read-only Git helper: what changed in the project, so Setu can write a commit message. It never changes the repository.
import { execFile } from 'child_process'

const MAX_DIFF = 12_000

function git(root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: root, timeout: 15_000, maxBuffer: 5_000_000, windowsHide: true }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

export type GitState =
  | { ok: false; reason: 'no-git' | 'not-a-repo' }
  | { ok: true; changed: number; diff: string; truncated: boolean }

export async function gitState(root: string): Promise<GitState> {
  try {
    await git(root, ['rev-parse', '--is-inside-work-tree'])
  } catch (e) {
    return { ok: false, reason: (e as { code?: string }).code === 'ENOENT' ? 'no-git' : 'not-a-repo' }
  }
  const status = (await git(root, ['status', '--porcelain'])).split('\n').filter(Boolean)
  if (status.length === 0) return { ok: true, changed: 0, diff: '', truncated: false }
  // "git diff HEAD" covers staged and unstaged changes; a brand-new repo has no HEAD, so fall back.
  let diff = ''
  try {
    diff = await git(root, ['diff', 'HEAD', '--no-color', '--unified=2'])
  } catch {
    diff = await git(root, ['diff', '--no-color', '--unified=2']).catch(() => '')
  }
  const untracked = status.filter((l) => l.startsWith('??')).map((l) => l.slice(3))
  if (untracked.length) diff += `\n(new files not in the diff yet: ${untracked.slice(0, 20).join(', ')})\n`
  const truncated = diff.length > MAX_DIFF
  return { ok: true, changed: status.length, diff: truncated ? diff.slice(0, MAX_DIFF) : diff, truncated }
}
