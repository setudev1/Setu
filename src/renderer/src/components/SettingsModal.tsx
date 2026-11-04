import AnimatedButton from '@/components/ui/animated-button'
import type { AccentId, Language, Prefs, ThemeId, WallpaperState } from '../types'
import { CloseIcon } from './icons'
import { CALL_OPTIONS, cleanInput } from '../lib/callme'
import PromptsEditor from './PromptsEditor'
import LearnedEditor from './LearnedEditor'
import { SCENES } from '../lib/scenes'
import { useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  wp: WallpaperState | null
  wpError: string
  onChooseWallpaper: () => void
  onClearWallpaper: () => void
  onLook: (dim: number, blur: number) => void
  prefs: Prefs
  onPrefs: (next: Prefs) => void
}

const THEME_LOOKS: { id: ThemeId; label: string; bg: string }[] = [
  { id: 'black', label: 'Black', bg: '#000000' },
  { id: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg,#04060d,#1b2440)' },
  { id: 'graphite', label: 'Graphite', bg: 'linear-gradient(135deg,#0a0b0d,#2a2e35)' },
  { id: 'plum', label: 'Plum', bg: 'linear-gradient(135deg,#080410,#33194d)' },
  { id: 'forest', label: 'Forest', bg: 'linear-gradient(135deg,#020805,#12402c)' },
  { id: 'light', label: 'Light', bg: 'linear-gradient(135deg,#ffffff,#dfe3e8)' }
]
const ACCENT_LOOKS: { id: AccentId; label: string; color: string }[] = [
  { id: 'mint', label: 'Mint', color: '#5fd3a3' },
  { id: 'blue', label: 'Blue', color: '#7a9cff' },
  { id: 'violet', label: 'Violet', color: '#a78bfa' },
  { id: 'amber', label: 'Amber', color: '#e8a33d' },
  { id: 'rose', label: 'Rose', color: '#f27a9b' }
]

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी (Hindi)' },
  { id: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { id: 'hinglish', label: 'Hinglish (Hindi in English letters)' }
]

export default function SettingsModal({
  open,
  onClose,
  wp,
  wpError,
  onChooseWallpaper,
  onClearWallpaper,
  onLook,
  prefs,
  onPrefs
}: Props) {
  const [upd, setUpd] = useState('')
  const [updBusy, setUpdBusy] = useState(false)
  if (!open) return null
  const has = !!wp?.url
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <h3>About you</h3>
          <p className="dim">Setu uses this to talk to you the way you like. It stays on this computer.</p>
          <div className="about-row">
            <input
              className="select-field"
              value={prefs.userName}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              onChange={(e) => onPrefs({ ...prefs, userName: cleanInput(e.target.value, 40) })}
            />
            <select
              className="select-field"
              aria-label="What Setu calls you"
              value={CALL_OPTIONS.some((o) => o.value === prefs.callMe) ? prefs.callMe : '__custom'}
              onChange={(e) => onPrefs({ ...prefs, callMe: e.target.value === '__custom' ? 'Chief' : e.target.value })}
            >
              {CALL_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.value ? `Call me ${o.label}` : 'Just use my name'}
                </option>
              ))}
              <option value="__custom">Something else…</option>
            </select>
            {!CALL_OPTIONS.some((o) => o.value === prefs.callMe) && (
              <input
                className="select-field"
                value={prefs.callMe}
                maxLength={24}
                aria-label="Your own title"
                onChange={(e) => onPrefs({ ...prefs, callMe: cleanInput(e.target.value, 24) })}
              />
            )}
          </div>

          <h3>Speed and look</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={prefs.fast}
              onChange={(e) => onPrefs({ ...prefs, fast: e.target.checked })}
            />
            <span>Fast and flat look (recommended)</span>
          </label>
          <p className="dim">
            Turns off blur, glowing buttons and the moving background. Setu feels quicker and uses less battery, which
            helps most on older laptops. Turn it off for the glass look.
          </p>

          <h3>Background</h3>
          <p className="dim">Black is the default. Pick another background and an accent colour for buttons and highlights.</p>
          <div className="swatches" role="group" aria-label="Background">
            {THEME_LOOKS.map((t) => (
              <button
                key={t.id}
                className="swatch"
                aria-pressed={prefs.theme === t.id}
                onClick={() => onPrefs({ ...prefs, theme: t.id })}
              >
                <span className="swatch-dot" style={{ background: t.bg }} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="swatches" role="group" aria-label="Accent colour">
            {ACCENT_LOOKS.map((a) => (
              <button
                key={a.id}
                className="swatch round"
                aria-pressed={prefs.accent === a.id}
                onClick={() => onPrefs({ ...prefs, accent: a.id })}
                aria-label={a.label}
                title={a.label}
              >
                <span className="swatch-dot" style={{ background: a.color }} />
              </button>
            ))}
          </div>

          <h3>Wallpaper</h3>
          <p className="dim">
            Pick a built-in wallpaper, or use any image, GIF or video from your computer (png, jpg, webp, gif, avif, mp4, webm). The file is
            copied into Setu and never leaves your computer.
          </p>
          <div className="scene-grid" role="group" aria-label="Built-in wallpapers">
            <button className="scene-tile" aria-pressed={!prefs.scene} onClick={() => onPrefs({ ...prefs, scene: '' })}>
              <span className="scene-thumb scene-none" />
              None
            </button>
            {SCENES.map((sc) => (
              <button
                key={sc.id}
                className="scene-tile"
                aria-pressed={prefs.scene === sc.id && !has}
                onClick={() => {
                  if (has) onClearWallpaper()
                  onPrefs({ ...prefs, scene: sc.id })
                }}
              >
                <span className={`scene-thumb wp-scene scene-${sc.id}`} />
                {sc.label}
              </button>
            ))}
          </div>
          <div className="add-row">
            <AnimatedButton size="sm" onClick={onChooseWallpaper}>
              {has ? 'Change wallpaper' : 'Choose a file'}
            </AnimatedButton>
            {has && (
              <button className="btn" onClick={onClearWallpaper}>
                Remove
              </button>
            )}
          </div>
          {wpError && <p className="msg-error">{wpError}</p>}
          {has && (
            <>
              <label className="setting-row">
                <span>Dim ({Math.round((wp?.dim ?? 0) * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={Math.round((wp?.dim ?? 0) * 100)}
                  onChange={(e) => onLook(Number(e.target.value) / 100, wp?.blur ?? 0)}
                  aria-label="Dim the wallpaper"
                />
              </label>
              <label className="setting-row">
                <span>Blur ({wp?.blur ?? 0}px)</span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={wp?.blur ?? 0}
                  onChange={(e) => onLook(wp?.dim ?? 0, Number(e.target.value))}
                  aria-label="Blur the wallpaper"
                />
              </label>
              {wp?.kind === 'video' && (
                <>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={prefs.pauseOnBattery}
                      onChange={(e) => onPrefs({ ...prefs, pauseOnBattery: e.target.checked })}
                    />
                    <span>Pause the video when my laptop is on battery</span>
                  </label>
                  <p className="dim">The video also pauses whenever Setu is minimized. Busy videos can slow weak laptops.</p>
                </>
              )}
            </>
          )}

          <h3>Updates</h3>
          <p className="dim">
            Setu tells you when a new version is out. You download it from the website and install it over the old one;
            your projects and chats stay. Setu only reads the public release page and sends nothing about you.
          </p>
          <div className="add-row">
            <AnimatedButton
              size="sm"
              disabled={updBusy}
              onClick={() => {
                setUpdBusy(true)
                setUpd('')
                void window.setu.update
                  .check()
                  .then((r) => {
                    if (r.failed) setUpd('Could not check. Are you online?')
                    else if (!r.configured) setUpd('Update checks are off in this build.')
                    else if (r.available && r.version) setUpd(`Setu ${r.version} is available. Use the Download button at the top.`)
                    else setUpd(`You have the newest Setu${r.current ? ` (${r.current})` : ''}.`)
                    if (r.available && r.version && r.url) {
                      try { localStorage.removeItem('setu.updateSkipped') } catch { /* ignore */ }
                      void window.setu.update.open(r.download || r.url)
                    }
                  })
                  .catch(() => setUpd('Could not check. Are you online?'))
                  .finally(() => setUpdBusy(false))
              }}
            >
              {updBusy ? 'Checking…' : 'Check for updates'}
            </AnimatedButton>
            {upd && <span className="dim" role="status">{upd}</span>}
          </div>

          <h3>Reply language</h3>
          <p className="dim">
            Setu's explanations come back in this language. Code and file names stay in English. Small models can be
            weak in Hindi and Gujarati, and bigger ones (7B or more) do better.
          </p>
          <select
            className="select-field"
            value={prefs.language}
            onChange={(e) => onPrefs({ ...prefs, language: e.target.value as Language })}
            aria-label="Reply language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>

          <h3>Teaching mode</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={prefs.explain}
              onChange={(e) => onPrefs({ ...prefs, explain: e.target.checked })}
            />
            <span>Explain every change in simple words, as if to a beginner</span>
          </label>

          <PromptsEditor />
          <LearnedEditor />
        </div>
      </div>
    </div>
  )
}
