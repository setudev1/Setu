import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useState } from 'react'
import { diskWarning, recommend } from '../lib/recommend'
import type { Pick } from '../lib/recommend'

type Props = {
  onDone: () => void
  onOpenModels: () => void
}

type Progress = { name: string; status: string; percent?: number; error?: string }

/** Shown on the home screen until a first model exists. It names every way to get one. */
export default function FirstRun({ onDone, onOpenModels }: Props) {
  const [info, setInfo] = useState<{ ramGB: number; freeDiskGB: number | null } | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    window.setu.system.info().then(setInfo).catch(() => setInfo(null))
  }, [])

  useEffect(
    () =>
      window.setu.ollama.onPullEvent((ev) => {
        setProgress((p) => {
          if (!p || ev.name !== p.name) return p
          if (ev.type === 'progress') {
            const percent = ev.total ? Math.round(((ev.completed ?? 0) / ev.total) * 100) : undefined
            return { ...p, status: ev.status, percent }
          }
          if (ev.type === 'done') return { ...p, status: 'Ready', percent: 100 }
          return { ...p, status: 'Failed', error: ev.message }
        })
        if (ev.type === 'done') onDone()
      }),
    [onDone]
  )

  const rec = recommend(info?.ramGB ?? null)
  const busy = !!progress && !progress.error && progress.status !== 'Ready'

  async function start(pick: Pick) {
    setProgress({ name: pick.name, status: 'Starting…' })
    try {
      await window.setu.ollama.pull(pick.name)
    } catch (e) {
      setProgress({ name: pick.name, status: 'Failed', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const warn = diskWarning(info?.freeDiskGB ?? null, rec.primary.sizeGB)

  return (
    <section className="first-run" aria-label="Set up your first model">
      <h2>Pick your first model</h2>
      <p className="dim">
        Setu doesn't ship with a model, so the installer stays small. Choose one below. You can add or switch models
        any time from Manage models.
      </p>

      <div className="fr-main">
        <div>
          <div className="fr-title">
            {rec.primary.title} <span className="model-size">~{rec.primary.sizeGB} GB</span>
            <span className="fr-tag">Suggested for this computer</span>
          </div>
          <div className="model-note">{rec.primary.why}</div>
        </div>
        <AnimatedButton disabled={busy} onClick={() => void start(rec.primary)}>
          {busy && progress?.name === rec.primary.name ? 'Downloading…' : 'Download and start'}
        </AnimatedButton>
      </div>

      {warn && <p className="msg-error">{warn}</p>}

      {progress && (
        <div className="model-progress">
          {!progress.error && progress.status !== 'Ready' && (
            <div className="bar">
              <div className="bar-fill" style={{ width: `${progress.percent ?? 5}%` }} />
            </div>
          )}
          <span className={progress.error ? 'err' : ''}>
            {progress.error ?? `${progress.status}${progress.percent !== undefined ? ` · ${progress.percent}%` : ''}`}
          </span>
        </div>
      )}

      <div className="fr-others">
        {rec.alternative && (
          <button className="link" disabled={busy} onClick={() => void start(rec.alternative!)}>
            Get {rec.alternative.title.toLowerCase()} instead (~{rec.alternative.sizeGB} GB)
          </button>
        )}
        <button className="link" onClick={onOpenModels}>
          Use a heavy cloud model (needs a free Ollama account)
        </button>
        <button className="link" onClick={onOpenModels}>
          Browse all models
        </button>
      </div>
    </section>
  )
}
