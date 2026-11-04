import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useState } from 'react'
import type { OllamaModel } from '../types'
import { formatBytes } from '../lib/format'
import { CloseIcon, DownloadIcon } from './icons'
import { isCloudModel } from '../lib/cloud'
import { CLOUD_CATALOG, GROUPS, isCataloged } from '../lib/catalog'
import { FIT_TEXT, fitFor, parseSizeGB, recommend, type Fit } from '../lib/recommend'

type Props = {
  open: boolean
  onClose: () => void
  status: 'checking' | 'running' | 'down'
  models: OllamaModel[]
  onRefresh: () => void
}

type PullState = { status: string; total?: number; completed?: number; error?: string; done?: boolean }

function isInstalled(models: OllamaModel[], name: string): boolean {
  return models.some((m) => m.name === name || m.name === `${name}:latest`)
}

export default function ModelManager({ open, onClose, status, models, onRefresh }: Props) {
  const [pulls, setPulls] = useState<Record<string, PullState>>({})
  const [custom, setCustom] = useState('')
  const [ramGB, setRamGB] = useState<number | null>(null)

  useEffect(() => {
    if (open) window.setu.system.info().then((i) => setRamGB(i.ramGB)).catch(() => setRamGB(null))
  }, [open])

  // Stays mounted while closed, so downloads keep reporting progress.
  useEffect(
    () =>
      window.setu.ollama.onPullEvent((ev) => {
        setPulls((prev) => {
          const next = { ...prev }
          if (ev.type === 'progress') {
            next[ev.name] = { status: ev.status, total: ev.total, completed: ev.completed }
          } else if (ev.type === 'done') {
            next[ev.name] = { status: 'Downloaded', done: true }
          } else {
            next[ev.name] = { status: 'Failed', error: ev.message }
          }
          return next
        })
        if (ev.type === 'done') onRefresh()
      }),
    [onRefresh]
  )

  async function start(name: string) {
    setPulls((p) => ({ ...p, [name]: { status: 'Starting…' } }))
    try {
      await window.setu.ollama.pull(name)
    } catch (e) {
      setPulls((p) => ({
        ...p,
        [name]: { status: 'Failed', error: e instanceof Error ? e.message : String(e) }
      }))
    }
  }

  if (!open) return null

  const busy = (name: string) => {
    const s = pulls[name]
    return !!s && !s.done && !s.error
  }

  function FitTag({ fit }: { fit: Fit }) {
    return fit === 'unknown' ? null : <span className={`fit fit-${fit}`}>{FIT_TEXT[fit]}</span>
  }

  function Row({ name, title, size, note }: { name: string; title: string; size: string; note?: string }) {
    const state = pulls[name]
    const installed = isInstalled(models, name)
    const percent = state?.total ? Math.round(((state.completed ?? 0) / state.total) * 100) : undefined
    return (
      <div className="model-row">
        <div className="model-info">
          <div className="model-title">
            {title} <span className="model-size">{size}</span>
          </div>
          {note && <div className="model-note">{note}</div>}
          {!isCloudModel(name) && <FitTag fit={fitFor(parseSizeGB(size), ramGB)} />}
          {state && !state.done && (
            <div className="model-progress">
              {busy(name) && (
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${percent ?? 5}%` }} />
                </div>
              )}
              <span className={state.error ? 'err' : ''}>
                {state.error ? state.error : `${state.status}${percent !== undefined ? ` · ${percent}%` : ''}`}
              </span>
            </div>
          )}
        </div>
        <div className="model-action">
          {installed ? (
            <span className="installed">Installed</span>
          ) : busy(name) ? (
            <button className="btn" onClick={() => void window.setu.ollama.cancelPull(name)}>
              Cancel
            </button>
          ) : (
            <AnimatedButton
              size="sm"
              variant={isCloudModel(name) ? 'primary' : 'glass'}
              disabled={status !== 'running'}
              onClick={() => void start(name)}
            >
              <DownloadIcon size={15} /> {isCloudModel(name) ? 'Add' : 'Download'}
            </AnimatedButton>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Manage models" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Models</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {status !== 'running' && (
          <div className="banner warn">
            <span>Ollama isn't running. Start Ollama, then reopen this window.</span>
            <button className="banner-btn" onClick={onRefresh}>
              Retry
            </button>
          </div>
        )}

        <div className="modal-body">
          {ramGB !== null && (
            <div className="pc-advice">
              <strong>Your computer has about {ramGB} GB of memory.</strong>{' '}
              Best pick: <b>{recommend(ramGB).primary.title}</b> ({recommend(ramGB).primary.name}). {recommend(ramGB).primary.why}
            </div>
          )}
          <h3>On this computer</h3>
          {models.length === 0 ? (
            <p className="dim">Nothing installed yet.</p>
          ) : (
            models.map((m) => (
              <div className="model-row" key={m.name}>
                <div className="model-info">
                  <div className="model-title">
                    {m.name} <span className="model-size">{formatBytes(m.size)}</span>
                  </div>
                  {!isCloudModel(m.name) && <FitTag fit={fitFor(m.size / 1024 ** 3, ramGB)} />}
                </div>
                <span className="installed">Installed</span>
              </div>
            ))
          )}

          <h3>Cloud models (heavy)</h3>
          <p className="dim">
            Models too big for most computers, run on Ollama's servers with your own Ollama account. Open the Ollama app
            and sign in once, then add a model here. A free account includes starter credits and one request at a time;
            the biggest models may need credits. While you use one, your messages and the project files Setu shows it are
            sent to Ollama, and Setu will ask you first.
          </p>
          {CLOUD_CATALOG.map((c) => (
            <Row key={c.name} name={c.name} title={c.title} size={c.size} note={c.note} />
          ))}

          <h3>Pick a model by what you need</h3>
          <p className="dim">Sizes are approximate downloads. The tag under each model tells you if it fits this computer.</p>
          <div className="model-groups">
            {GROUPS.map((g) => (
              <details key={g.id} className="model-group" open={g.id === 'coding'}>
                <summary>
                  <strong>{g.title}</strong> <span className="dim">· {g.models.length} models</span>
                </summary>
                <p className="dim model-blurb">{g.blurb}</p>
                {g.models.map((c) => (
                  <Row key={c.name} name={c.name} title={c.title} size={c.size} note={c.note} />
                ))}
              </details>
            ))}
          </div>

          <h3>Add by name</h3>
          <p className="dim">Any model from Ollama's library, for example glm-4.7-flash. Cloud models end in :cloud (see ollama.com/search?c=cloud).</p>
          <div className="add-row">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="model-name:tag"
              spellCheck={false}
            />
            <AnimatedButton
              size="sm"
              disabled={status !== 'running' || !custom.trim() || busy(custom.trim())}
              onClick={() => {
                void start(custom.trim())
                setCustom('')
              }}
            >
              Download
            </AnimatedButton>
          </div>
          {Object.entries(pulls)
            .filter(([name]) => !isCataloged(name))
            .map(([name]) => (
              <Row key={name} name={name} title={name} size="" />
            ))}
        </div>
      </div>
    </div>
  )
}
