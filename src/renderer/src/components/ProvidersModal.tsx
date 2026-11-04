import AnimatedButton from '@/components/ui/animated-button'
import { useEffect, useMemo, useState } from 'react'
import { CloseIcon } from './icons'
import type { SavedApiModel, SavedOrModel } from '../lib/cloud'
import ApiKeys from './ApiKeys'
import { formatTokens, loadCap, loadUsage, saveCap, totalTokens } from '../lib/usage'

type OrListItem = { id: string; name: string; free: boolean; vision: boolean; context: number }

type Props = {
  open: boolean
  onClose: () => void
  hasKey: boolean
  onKeyChange: (has: boolean) => void
  saved: SavedOrModel[]
  onSaved: (next: SavedOrModel[]) => void
  apiModels: SavedApiModel[]
  onApiModels: (next: SavedApiModel[]) => void
  onApiCount: (n: number) => void
}

// "Providers" is where cloud models from other companies are connected. Today: OpenRouter, which reaches hundreds of models.
export default function ProvidersModal({ open, onClose, hasKey, onKeyChange, saved, onSaved, apiModels, onApiModels, onApiCount }: Props) {
  const [key, setKey] = useState('')
  const [keyMsg, setKeyMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState<OrListItem[] | null>(null)
  const [listErr, setListErr] = useState('')
  const [q, setQ] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [usage, setUsage] = useState(loadUsage)
  const [tab, setTab] = useState<'or' | 'key' | 'usage'>('or')
  const [cap, setCap] = useState(() => String(loadCap() || ''))

  useEffect(() => {
    if (open) setUsage(loadUsage())
  }, [open])

  useEffect(() => {
    if (!open || list) return
    let live = true
    void window.setu.openrouter.models().then((r) => {
      if (!live) return
      if (r.ok) setList(r.models)
      else setListErr(r.error)
    })
    return () => {
      live = false
    }
  }, [open, list])

  const savedIds = useMemo(() => new Set(saved.map((m) => m.id)), [saved])
  const shown = useMemo(() => {
    if (!list) return []
    const needle = q.trim().toLowerCase()
    return list
      .filter((m) => (!freeOnly || m.free) && (!needle || m.id.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle)))
      .slice(0, 40)
  }, [list, q, freeOnly])

  if (!open) return null

  async function saveKey() {
    setBusy(true)
    setKeyMsg('')
    const r = await window.setu.openrouter.setKey(key)
    setBusy(false)
    if (r.ok) {
      setKey('')
      onKeyChange(true)
    } else {
      setKeyMsg(r.error ?? 'Could not save the key.')
    }
  }

  async function removeKey() {
    await window.setu.openrouter.clearKey()
    onKeyChange(false)
  }

  function add(m: OrListItem) {
    if (!savedIds.has(m.id)) onSaved([...saved, { id: m.id, name: m.name, free: m.free, vision: m.vision }])
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Providers" style={{ minHeight: 'min(640px, 88vh)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Providers</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="prov-tabs" role="tablist" aria-label="Ways to add a model">
          <button role="tab" aria-selected={tab === 'or'} className={tab === 'or' ? 'active' : ''} onClick={() => setTab('or')}>
            OpenRouter
            <small>hundreds of cloud models</small>
          </button>
          <button role="tab" aria-selected={tab === 'key'} className={tab === 'key' ? 'active' : ''} onClick={() => setTab('key')}>
            Your own API key
            <small>OpenAI, Google and others</small>
          </button>
          <button role="tab" aria-selected={tab === 'usage'} className={tab === 'usage' ? 'active' : ''} onClick={() => setTab('usage')}>
            Usage
            <small>this month</small>
          </button>
        </div>
        <div className="modal-body">
          {tab === 'usage' && (
          <>
          <h3>Usage this month</h3>
          <p className="dim">
            Tokens used by cloud models, counted on this computer only. Your provider's own page has the real bill. Free models and free plans have limits that the provider sets and can change, and Setu cannot see how much of that free allowance is left. If a free model says "too many requests", wait a while or switch to a model on this computer.
          </p>
          <div className="usage-box">
            <strong>{formatTokens(totalTokens(usage))} tokens</strong>
            {Object.entries(usage.byModel).map(([m, v]) => (
              <span key={m} className="dim usage-row">
                {m}: {formatTokens(v.input + v.output)}
              </span>
            ))}
            <label className="usage-cap">
              Monthly limit (tokens, empty = none)
              <input
                value={cap}
                inputMode="numeric"
                aria-label="Monthly token limit"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setCap(v)
                  saveCap(Number(v) || 0)
                }}
              />
            </label>
          </div>
          </>
          )}

          {tab === 'key' && <ApiKeys models={apiModels} onModels={onApiModels} onCount={onApiCount} />}

          {tab === 'or' && (
          <>
          <h3>OpenRouter (hundreds of cloud models)</h3>
          <p className="dim">
            One free account at openrouter.ai gives you a key that works with models from many companies, including free
            ones. Create a key there, paste it below, then add the models you want. Your key is encrypted on this
            computer and is only used to talk to OpenRouter. While you use a cloud model, your messages, the project
            files Setu shows it and any screenshots are sent to OpenRouter and the model's company. Setu asks you first.
          </p>
          {hasKey ? (
            <div className="add-row">
              <span className="installed">Key saved ✓</span>
              <button className="btn" onClick={() => void removeKey()}>
                Remove key
              </button>
            </div>
          ) : (
            <div className="add-row">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-or-..."
                spellCheck={false}
                autoComplete="off"
                aria-label="OpenRouter key"
              />
              <AnimatedButton size="sm" disabled={busy || !key.trim()} onClick={() => void saveKey()}>
                Save key
              </AnimatedButton>
            </div>
          )}
          {keyMsg && <p className="msg-error">{keyMsg}</p>}

          {saved.length > 0 && (
            <>
              <h3>Your cloud models</h3>
              {saved.map((m) => (
                <div className="model-row" key={m.id}>
                  <div className="model-info">
                    <div className="model-title">{m.name}</div>
                    <div className="dim">
                      {m.id}
                      {m.free ? ' · free' : ''}
                      {m.vision ? ' · reads pictures' : ''}
                    </div>
                  </div>
                  <button className="btn" onClick={() => onSaved(saved.filter((x) => x.id !== m.id))}>
                    Remove
                  </button>
                </div>
              ))}
            </>
          )}

          <h3>Find a model</h3>
          <div className="add-row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, for example qwen, deepseek, gemini"
              spellCheck={false}
              aria-label="Search models"
            />
          </div>
          <label className="check-row">
            <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
            <span>Free models only</span>
          </label>
          {listErr && <p className="msg-error">{listErr}</p>}
          {!list && !listErr && <p className="dim">Loading the list…</p>}
          {shown.map((m) => (
            <div className="model-row" key={m.id}>
              <div className="model-info">
                <div className="model-title">{m.name}</div>
                <div className="dim">
                  {m.id}
                  {m.free ? ' · free' : ''}
                  {m.vision ? ' · reads pictures' : ''}
                </div>
              </div>
              {savedIds.has(m.id) ? (
                <span className="installed">Added</span>
              ) : (
                <AnimatedButton size="sm" onClick={() => add(m)}>
                  Add
                </AnimatedButton>
              )}
            </div>
          ))}
          {list && shown.length === 0 && <p className="dim">No models match.</p>}
          {list && shown.length === 40 && <p className="dim">Showing the first 40. Type more to narrow it down.</p>}
          </>
          )}
        </div>
      </div>
    </div>
  )
}
