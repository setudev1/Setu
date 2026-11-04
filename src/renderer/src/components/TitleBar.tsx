import type { Mode } from '../types'
import { SidebarIcon } from './icons'

type Props = {
  mode: Mode
  onModeChange: (mode: Mode) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  title: string
  previewOpen?: boolean
  onTogglePreview?: () => void
  runOpen?: boolean
  onToggleRun?: () => void
}

export default function TitleBar({ mode, onModeChange, sidebarOpen, onToggleSidebar, title, previewOpen, onTogglePreview, runOpen, onToggleRun }: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar-left no-drag">
        <div className="segmented" role="tablist" aria-label="Mode">
          <button
            role="tab"
            aria-selected={mode === 'agent'}
            className={mode === 'agent' ? 'seg active' : 'seg'}
            onClick={() => onModeChange('agent')}
          >
            Agent
          </button>
          <button
            role="tab"
            aria-selected={mode === 'editor'}
            className={mode === 'editor' ? 'seg active' : 'seg'}
            onClick={() => onModeChange('editor')}
          >
            Editor
          </button>
        </div>
        <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar" aria-pressed={sidebarOpen}>
          <SidebarIcon />
        </button>
      </div>
      <div className="titlebar-title">{title}</div>
      <div className="titlebar-right no-drag">
        {onToggleRun && (
          <button className={runOpen ? 'chip pill on' : 'chip'} onClick={onToggleRun} aria-pressed={!!runOpen} title="Run your project and fix errors with Setu">
            Run
          </button>
        )}
        {onTogglePreview && (
          <button className={previewOpen ? 'chip pill on' : 'chip'} onClick={onTogglePreview} aria-pressed={!!previewOpen} title="See your page next to the chat">
            Preview
          </button>
        )}
      </div>
    </header>
  )
}
