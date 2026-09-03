import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initializeEpubFileHandling } from './features/library/model/epub-file-launch'
import './styles/base.css'
import './styles/about.css'
import './styles/privacy.css'
import './styles/library.css'
import './styles/reader.css'

if (__LENTO_BUILD_TARGET__ === 'web') {
  initializeEpubFileHandling()
  if (import.meta.env.PROD) {
    void import('./register-service-worker').then(
      ({ registerServiceWorker }) => {
        registerServiceWorker()
      },
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
