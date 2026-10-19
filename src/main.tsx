import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Provider } from 'react-redux'
import App from './App.tsx'
import { getSettings } from './hooks/useSettings'
import { store } from './store'
import { applySettings } from './utils/settings'

// Before the first paint, so the saved theme doesn't flash in
applySettings(getSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
