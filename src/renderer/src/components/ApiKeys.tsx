import AnimatedButton from '@/components/ui/animated-button'
import { useCallback, useEffect, useState } from 'react'
import { apiModelName, looksLikeVision, type SavedApiModel } from '../lib/cloud'

type Preset = { id: string; label: string; kind: string; baseUrl: string }
type Configured = Preset & { hasKey: boolean }

const MODEL_EXAMPLES: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest'
}

// "Use my own API key": OpenAI, Claude, Gemini, Groq, DeepSeek, Mistral, or any OpenAI-compatible address.
export default function ApiKeys({
  models,
  onModels,
  onCount
}: {
  models: SavedApiModel[]
  onModels: (next: SavedApiModel[]) => void
  onCount: (n: number) => void
}) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [configured, setConfigured] = useState<Configured[]>([])
  const [pick, setPick] = useState('openai')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [modelInput, setModelInput] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const r = await window.setu.providers.list()
    setPresets(r.presets)
    setConfigured(r.providers)
    onCount(r.providers.filter((p) => p.hasKey).length)
  }, [onCount])

  useEffect(() => {
    void load()
  }, [load])

  const custom = pick === 'custom'

  async function save() {
    setBusy(true)
    setMsg('')
    const r = await window.setu.providers.save(custom ? { label, baseUrl: url, key } : { presetId: pick, key })
    setBusy(false)
    if (r.ok) {
      setKey('')
      setLabel('')
      setUrl('')
      await load()
    } else {
      setMsg(r.error ?? 'Could not save.')
    }
  }

  async function remove(id: string) {
    await window.setu.providers.remove(id)
    onModels(models.filter((m) => m.provider !== id))
    await load()
  }

  function addModel(p: Configured) {
    const model = (modelInput[p.id] ?? '').trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,100}$/.test(model)) {
      setMsg('Type the model name exactly as the provider shows it, for example ' + (MODEL_EXAMPLES[p.id] ?? 'my-model') + '.')
      return
    }
    setMsg('')
    if (!models.some((m) => m.provider === p.id && m.model === model)) {
      onModels([...models, { provider: p.id, label: p.label, model, vision: looksLikeVision(model) }])
    }
    setModelInput({ ...modelInput, [p.id]: '' })
  }

  return (
    <>
      <h3>Use your own API key</h3>
      <p className="dim">
        Have a key from OpenAI, Anthropic (Claude), Google Gemini, Groq, DeepSeek or Mistral? Add it here, then add the
        model names you want. Any other service that works like OpenAI can be added with its address. Keys are encrypted
        on this computer and only sent to that company. While you use one of these models, your messages, the project
        files Setu shows it and any screenshots go to that company, and Setu asks you first.
      </p>

      {configured.map((p) => (
        <div key={p.id} className="model-row api-provider">
          <div className="model-info">
            <div className="model-title">
              {p.label} {p.hasKey ? <span className="installed">key saved ✓</span> : <span className="msg-error">key missing</span>}
            </div>
            <div className="add-row">
              <input
                value={modelInput[p.id] ?? ''}
                onChange={(e) => setModelInput({ ...modelInput, [p.id]: e.target.value })}
                placeholder={`Model name, for example ${MODEL_EXAMPLES[p.id] ?? 'my-model'}`}
                spellCheck={false}
                aria-label={`Model name for ${p.label}`}
                onKeyDown={(e) => e.key === 'Enter' && addModel(p)}
              />
              <AnimatedButton size="sm" onClick={() => addModel(p)}>
                Add model
              </AnimatedButton>
            </div>
            {models
              .filter((m) => m.provider === p.id)
              .map((m) => (
                <div className="api-model" key={m.model}>
                  <span>{m.model}</span>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={m.vision}
                      onChange={(e) =>
                        onModels(models.map((x) => (apiModelName(x) === apiModelName(m) ? { ...x, vision: e.target.checked } : x)))
                      }
                    />
                    <span>reads pictures</span>
                  </label>
                  <button className="btn" onClick={() => onModels(models.filter((x) => apiModelName(x) !== apiModelName(m)))}>
                    Remove
                  </button>
                </div>
              ))}
          </div>
          <button className="btn" onClick={() => void remove(p.id)}>
            Remove provider
          </button>
        </div>
      ))}

      <div className="add-row">
        <select className="select-field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Provider">
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Other (OpenAI-compatible address)</option>
        </select>
      </div>
      {custom && (
        <>
          <div className="add-row">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, for example Together" aria-label="Provider name" />
          </div>
          <div className="add-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
              aria-label="Provider address"
            />
          </div>
        </>
      )}
      <div className="add-row">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste the API key"
          spellCheck={false}
          autoComplete="off"
          aria-label="API key"
        />
        <AnimatedButton size="sm" disabled={busy || !key.trim()} onClick={() => void save()}>
          Save key
        </AnimatedButton>
      </div>
      {msg && <p className="msg-error">{msg}</p>}
    </>
  )
}
