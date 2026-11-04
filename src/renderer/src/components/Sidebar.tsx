import AnimatedButton from '@/components/ui/animated-button'
import type { SpacesState } from '../types'
import { ChatIcon, CloseIcon, FolderIcon, HistoryIcon, KeyIcon, PlusIcon, ReviewIcon, SettingsIcon, ShieldIcon } from './icons'

type Props = {
  spaces: SpacesState
  onNewSession: () => void
  onAddSpace: () => void
  onSelectSpace: (path: string) => void
  onRemoveSpace: (path: string) => void
  onOpenCheckpoints: () => void
  onOpenSettings: () => void
  providerCount?: number
  onOpenProviders?: () => void
  onOpenHelp?: () => void
}

export default function Sidebar({
  spaces,
  onNewSession,
  onAddSpace,
  onSelectSpace,
  onRemoveSpace,
  onOpenCheckpoints,
  onOpenSettings,
  providerCount = 0,
  onOpenProviders,
  onOpenHelp
}: Props) {
  return (
    <aside className="sidebar">
      <AnimatedButton variant="glass" className="new-session" onClick={onNewSession}>
        <PlusIcon /> New session
      </AnimatedButton>

      <nav className="nav">
        <button className="nav-item">
          <ChatIcon /> Sessions
        </button>
        <button className="nav-item" onClick={onOpenCheckpoints}>
          <HistoryIcon /> Checkpoints
        </button>
        <button className="nav-item">
          <ReviewIcon /> Review
        </button>
        <button className="nav-item">
          <ShieldIcon /> Security
        </button>
      </nav>

      <div className="section-head">
        <span>Spaces</span>
        <button className="icon-btn small" onClick={onAddSpace} aria-label="Add a project folder" title="Add a project folder">
          <PlusIcon size={16} />
        </button>
      </div>
      {spaces.spaces.length === 0 ? (
        <div className="empty-note">
          <FolderIcon size={16} />
          <span>No project folders yet. Click + to choose one. Setu only touches folders you choose.</span>
        </div>
      ) : (
        <div className="spaces">
          {spaces.spaces.map((s) => (
            <div className={s.path === spaces.active ? 'space active' : 'space'} key={s.path}>
              <button className="space-main" onClick={() => onSelectSpace(s.path)} title={s.path}>
                <FolderIcon size={16} />
                <span className="space-name">{s.name}</span>
              </button>
              <button
                className="icon-btn small space-remove"
                onClick={() => onRemoveSpace(s.path)}
                aria-label={`Remove ${s.name} from the list`}
                title="Remove from list (your files are not deleted)"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <button className="nav-item" onClick={onOpenProviders}>
          <KeyIcon /> Providers <span className="count">{providerCount}</span>
        </button>
        <button className="nav-item" onClick={onOpenHelp}>
          <span className="help-q">?</span> Help
        </button>
        <button className="nav-item" onClick={onOpenSettings}>
          <SettingsIcon /> Settings
        </button>
      </div>
    </aside>
  )
}
