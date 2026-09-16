import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import CookieConsent from './CookieConsent'

createRoot(document.getElementById('landing-config-root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

createRoot(document.getElementById('cookie-consent-root')!).render(
  <StrictMode>
    <CookieConsent />
  </StrictMode>,
)
