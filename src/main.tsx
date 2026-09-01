import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

if (__LENTO_BUILD_TARGET__ === 'web' && import.meta.env.PROD) {
  void import('./register-service-worker').then(({ registerServiceWorker }) => {
    registerServiceWorker()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
