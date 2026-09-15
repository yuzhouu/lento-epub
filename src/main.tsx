import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './i18n'
import { App } from './App'
import { normalizeLegacyPublicRoute, resolveAppRoute } from './lib/app-route'
import { getPrerenderedPage } from './seo/hydration'
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

if (!normalizeLegacyPublicRoute()) {
  const root = document.getElementById('root')!
  const prerenderedPage = __LENTO_BUILD_TARGET__ === 'web'
    ? getPrerenderedPage(root)
    : undefined
  const initialRoute = prerenderedPage
    ? { page: prerenderedPage }
    : resolveAppRoute(window.location.pathname, window.location.hash, import.meta.env.BASE_URL)
  const app = (
    <StrictMode>
      <App initialRoute={initialRoute} />
    </StrictMode>
  )
  if (prerenderedPage) {
    hydrateRoot(root, app)
  } else {
    createRoot(root).render(app)
  }
}
