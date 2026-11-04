import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useState } from 'react'
import { CloseIcon } from './icons'

type Props = { open: boolean; onClose: () => void; spaceName: string | null }

// Make an image with the user's own free Cloudflare account. The prompt goes to Cloudflare, so this is clearly labelled.
export default function ImageModal({ open, onClose, spaceName }: Props) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [account, setAccount] = useState('')
  const [token, setToken] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pic, setPic] = useState<{ path: string | null; dataUrl: string } | null>(null)
  useEffect(() => {
    if (!open) return
    setErr('')
    window.setu.image.status().then(setReady).catch(() => setReady(false))
  }, [open])
  if (!open) return null
  const fail = (e: unknown): void => setErr(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Something went wrong.')
  async function saveKey() {
    setErr('')
    try {
      await window.setu.image.setKey(account, token)
      setToken('')
      setReady(true)
    } catch (e) {
      fail(e)
    }
  }
  async function make() {
    setErr('')
    setBusy(true)
    try {
      setPic(await window.setu.image.make(prompt))
    } catch (e) {
      fail(e)
    }
    setBusy(false)
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal image-modal" role="dialog" aria-label="Make an image" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Make an image</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="dim">
          Uses your own free Cloudflare account (FLUX model). Your words are sent to Cloudflare to make the picture. Nothing else is sent.
        </p>
        {ready === false && (
          <div className="image-setup">
            <ol className="dim">
              <li>Make a free account at cloudflare.com.</li>
              <li>Copy your <b>Account ID</b> (Workers AI page).</li>
              <li>Create an <b>API token</b> that can use Workers AI.</li>
            </ol>
            <input className="select-field" value={account} placeholder="Account ID" aria-label="Cloudflare Account ID" onChange={(e) => setAccount(e.target.value)} />
            <input className="select-field" type="password" value={token} placeholder="API token" aria-label="Cloudflare API token" onChange={(e) => setToken(e.target.value)} />
            <AnimatedButton size="sm" disabled={!account.trim() || !token.trim()} onClick={() => void saveKey()}>
              Save (kept encrypted on this PC)
            </AnimatedButton>
          </div>
        )}
        {ready && (
          <>
            <textarea
              className="select-field"
              rows={3}
              maxLength={1500}
              value={prompt}
              placeholder="A diya glowing next to a laptop, dark background, cinematic"
              aria-label="Describe the picture"
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="modal-actions">
              <button className="link" onClick={() => void window.setu.image.clear().then(() => setReady(false))}>
                Remove my Cloudflare details
              </button>
              <AnimatedButton size="sm" disabled={busy || !prompt.trim()} onClick={() => void make()}>
                {busy ? 'Making…' : 'Make image'}
              </AnimatedButton>
            </div>
          </>
        )}
        {err && <p className="msg-error">{err}</p>}
        {pic && (
          <div className="image-result">
            <img src={pic.dataUrl} alt="The picture Setu made" />
            <p className="dim">{pic.path ? `Saved in ${spaceName ?? 'your project'} as ${pic.path}` : 'Not saved: choose a project folder first to keep pictures.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
