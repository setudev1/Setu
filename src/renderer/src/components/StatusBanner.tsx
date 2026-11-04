import { useEffect, useState } from 'react'

type Props = {
  status: 'checking' | 'running' | 'down'
  hasModels: boolean
  onRetry: () => void
  onManage: () => void
}

type Setup = { busy: boolean; message: string; percent?: number; error: string }

// Ollama is the engine that runs the models on this computer. If it is missing or stopped, Setu can fix that itself.
function OllamaDown({ onRetry }: { onRetry: () => void }) {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [s, setS] = useState<Setup>({ busy: false, message: '', error: '' })
  const windows = window.setu.platform === 'win32'

  useEffect(() => {
    void window.setu.setup.installed().then(setInstalled).catch(() => setInstalled(false))
    return window.setu.setup.onEvent((e) => {
      if (e.type === 'progress') setS({ busy: true, message: e.message, percent: e.percent, error: '' })
      else if (e.type === 'done') {
        setS({ busy: false, message: '', error: '' })
        setInstalled(true)
        onRetry()
      } else setS({ busy: false, message: '', error: e.message })
    })
  }, [onRetry])

  async function startOnly() {
    setS({ busy: true, message: 'Starting Ollama…', error: '' })
    const ok = await window.setu.setup.start()
    setS({ busy: false, message: '', error: ok ? '' : 'Ollama did not start. Open it from the Start menu, then press Retry.' })
    if (ok) onRetry()
  }

  if (s.busy) {
    return (
      <div className="banner info" role="status">
        <span>
          {s.message}
          {s.percent !== undefined && (
            <span className="bar setup-bar">
              <span className="bar-fill" style={{ width: `${s.percent}%` }} />
            </span>
          )}
        </span>
        {s.percent !== undefined && (
          <button className="banner-btn" onClick={() => void window.setu.setup.cancel().then(() => setS({ busy: false, message: '', error: 'Cancelled.' }))}>
            Cancel
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="banner info">
      <span>
        {installed
          ? "Setu's AI engine (Ollama) did not start by itself. Press Start to try again."
          : windows
            ? 'One-time setup: Setu runs AI on your own computer using a free engine called Ollama (about 1 GB). Press Set up and Setu does the rest.'
            : 'Setu needs Ollama. Install it from ollama.com/download, then press Retry.'}
        {s.error && <span className="msg-error"> {s.error}</span>}
      </span>
      <span className="secret-actions">
        {installed ? (
          <button className="banner-btn" onClick={() => void startOnly()}>
            Start
          </button>
        ) : windows ? (
          <button className="banner-btn" onClick={() => void window.setu.setup.install()}>
            Set up
          </button>
        ) : null}
        <button className="banner-btn" onClick={onRetry}>
          Retry
        </button>
      </span>
    </div>
  )
}

export default function StatusBanner({ status, hasModels, onRetry, onManage }: Props) {
  // While Setu starts its AI engine on its own, say so quietly. It only appears if this takes more than a moment.
  if (status === 'checking') {
    return (
      <div className="banner info banner-delayed" role="status">
        <span>Starting Setu's AI engine…</span>
      </div>
    )
  }
  if (status === 'down') return <OllamaDown onRetry={onRetry} />
  if (!hasModels) {
    return (
      <div className="banner info">
        <span>No models installed yet. Download one to start chatting.</span>
        <button className="banner-btn" onClick={onManage}>
          Manage models
        </button>
      </div>
    )
  }
  return null
}
