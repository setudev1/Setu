import { useEffect, useRef, useState } from 'react'
import { buildPreviewDoc } from '../lib/preview'
import { makeShareCard } from '../lib/shareCard'

type Props = {
  spaceName: string | null
  /** Changes whenever files were saved, so the preview reloads. */
  version: number
  onClose: () => void
}

export default function PreviewPanel({ spaceName, version, onClose }: Props) {
  const [doc, setDoc] = useState<string | null>(null)
  const [empty, setEmpty] = useState('')
  const [phone, setPhone] = useState(false)
  const [tick, setTick] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  const stageRef = useRef<HTMLDivElement>(null)

  // Makes a picture of the page with Setu's name on it and saves it, ready to post.
  async function share(): Promise<void> {
    setShareMsg('Making your picture…')
    try {
      let shot: string | null = null
      const el = stageRef.current
      if (el && doc !== null) {
        const r = el.getBoundingClientRect()
        shot = (await window.setu.share?.capture({ x: r.left, y: r.top, width: r.width, height: r.height })) ?? null
      }
      const blob = await makeShareCard(spaceName ?? 'my project', shot)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `made-with-setu-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      setShareMsg('Saved to your Downloads. Post it with #MadeWithSetu!')
    } catch {
      setShareMsg('Could not make the picture. Try again.')
    }
    setTimeout(() => setShareMsg(''), 6000)
  }

  useEffect(() => {
    let live = true
    setEmpty('')
    if (!spaceName) {
      setDoc(null)
      setEmpty('Choose a project folder first. The preview shows its index.html.')
      return
    }
    void buildPreviewDoc((p) => window.setu.project.read(p))
      .then((r) => {
        if (!live) return
        if ('doc' in r) setDoc(r.doc)
        else {
          setDoc(null)
          setEmpty(r.empty)
        }
      })
      .catch(() => live && (setDoc(null), setEmpty('Could not load the preview.')))
    return () => {
      live = false
    }
  }, [spaceName, version, tick])

  return (
    <aside className="preview-panel" aria-label="Preview">
      <div className="preview-bar">
        <strong>Preview</strong>
        <span className="preview-name">{spaceName ?? ''}</span>
        <span className="preview-actions">
          <button className="chip" onClick={() => setPhone((p) => !p)} aria-pressed={phone} title="Switch between a computer and a phone width">
            {phone ? 'Phone' : 'Computer'}
          </button>
          <button className="chip" onClick={() => void share()} disabled={doc === null} title="Save a picture of your page with Setu's name on it, ready to post">
            Share my build
          </button>
          <button className="chip" onClick={() => setTick((t) => t + 1)} title="Load the files again">
            Refresh
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview">
            ×
          </button>
        </span>
      </div>
      <div className="preview-stage" ref={stageRef}>
        {doc !== null ? (
          <iframe
            title="Preview of your project"
            className={phone ? 'preview-frame phone' : 'preview-frame'}
            sandbox="allow-scripts"
            srcDoc={doc}
          />
        ) : (
          <p className="preview-empty">{empty || 'Loading…'}</p>
        )}
      </div>
      {shareMsg && <p className="preview-foot" role="status">{shareMsg}</p>}
      <p className="preview-foot">Runs offline in a locked box. Pages that load things from the internet may look different here.</p>
    </aside>
  )
}
