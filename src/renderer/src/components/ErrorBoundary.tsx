import { Component, type ReactNode } from 'react'

type State = { error: string | null }

// If a screen crashes, show a calm page with a way forward instead of a blank window. Nothing the person saved is lost.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(e: unknown): State {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  componentDidCatch(e: unknown): void {
    try {
      void window.setu?.report?.log(e instanceof Error ? `${e.message} ${(e.stack ?? '').split('\n').slice(1, 3).join(' ')}` : String(e))
    } catch {
      /* logging must never break the screen */
    }
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return (
      <div className="placeholder" style={{ padding: 24, maxWidth: 560, margin: '10vh auto' }} role="alert">
        <h2>Something went wrong</h2>
        <p>
          Setu hit a problem on this screen. Your projects and chats are safe on your computer. Reload to continue. If it
          keeps happening, please tell us.
        </p>
        <p className="dim" style={{ overflowWrap: 'anywhere' }}>{this.state.error.slice(0, 200)}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => window.location.reload()}>Reload Setu</button>
          <button className="btn" onClick={() => void window.setu?.report?.open(`Setu showed "Something went wrong": ${this.state.error}`)}>
            Report this problem
          </button>
        </div>
      </div>
    )
  }
}
