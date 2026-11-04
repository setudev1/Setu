import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './styles/theme.css'
import './styles/app.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// Setu only works inside its own desktop window. A normal browser tab has no connection to Ollama.
if (!window.setu) {
  root.render(
    <div className="placeholder" style={{ padding: 24 }}>
      <h2>Open the Setu desktop window</h2>
      <p>
        This page only works inside the Setu app. Look for the separate window named Setu (check the
        taskbar), not this browser tab.
      </p>
    </div>
  )
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

// Errors that happen outside a screen (a button handler, a promise) go to the log too.
window.addEventListener('error', (e) => void window.setu?.report?.log(`${e.message} @ ${String(e.filename ?? '').split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => void window.setu?.report?.log(`promise: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`))
