import { useState } from 'react'
import { CloseIcon } from './icons'

type Props = {
  open: boolean
  onClose: () => void
  version: string
  model: string
  modelCount: number
  ollama: string
}

export default function HelpModal({ open, onClose, version, model, modelCount, ollama }: Props) {
  const [copied, setCopied] = useState(false)
  if (!open) return null

  // Nothing private: no chats, no file names, no keys.
  const info = [
    `Setu ${version}`,
    `Windows/OS: ${navigator.userAgent.replace(/.*\((.*?)\).*/, '$1')}`,
    `Ollama: ${ollama}`,
    `Models installed: ${modelCount}`,
    `Selected model type: ${model.startsWith('or:') ? 'OpenRouter' : model.startsWith('api:') ? 'own API key' : /[:-]cloud$/i.test(model) ? 'Ollama cloud' : model ? 'local' : 'none'}`
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(info)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Help" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Help</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <h3>Start in 5 steps</h3>
          <ol className="help-list">
            <li>Make sure Ollama is running. If Setu says it isn't, press <b>Set up Ollama for me</b> or <b>Start Ollama</b>.</li>
            <li>Under Manage models, download a small model first (for example Qwen2.5 Coder 1.5B).</li>
            <li>Choose a project folder in the sidebar so Setu can create and edit files.</li>
            <li>Ask for something. Setu shows the changes first. You press Save, and it makes an undo point.</li>
            <li>Use <b>Preview</b> to see a web page, or <b>Run</b> to test code. If it fails, press <b>Fix this with Setu</b>.</li>
          </ol>
          <h3>Handy things</h3>
          <ul className="help-list">
            <li>Type <b>@</b> in the message box to point at a file.</li>
            <li>Paste or attach a screenshot of an error with the + button.</li>
            <li>Ctrl+N new session · Ctrl+K type a message · Ctrl+. show or hide the preview</li>
            <li>Settings has your name, wallpaper, reply language and Teaching mode.</li>
            <li>Providers has OpenRouter and your own API keys for cloud models.</li>
          </ul>
          <h3>Something went wrong?</h3>
          <p className="dim">
            Copy this information and send it to us with a short description. It has no chats, files or keys in it.
          </p>
          <pre className="run-output help-info">{info}</pre>
          <button className="btn" onClick={() => void copy()}>
            {copied ? 'Copied ✓' : 'Copy bug-report info'}
          </button>
        </div>
      </div>
    </div>
  )
}
