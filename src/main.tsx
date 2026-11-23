import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800.css'
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
