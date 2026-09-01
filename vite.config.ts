import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type BuildTarget = 'web' | 'extension'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const iconDirectory = join(projectRoot, 'public/icons')

function getBuildTarget(mode: string): BuildTarget {
  return mode === 'extension' ? 'extension' : 'web'
}

function getWebBasePath(): string {
  const configuredBase = process.env.LENTO_BASE_PATH?.trim() || '/'
  const withLeadingSlash = configuredBase.startsWith('/')
    ? configuredBase
    : `/${configuredBase}`
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`
}

function targetHtmlPlugin(target: BuildTarget, base: string): Plugin {
  return {
    name: 'lento-target-html',
    transformIndexHtml(html) {
      const webHead = `
    <link rel="icon" href="${base}icons/lento.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${base}icons/lento-128.png" />
    <link rel="manifest" href="${base}manifest.webmanifest" />`

      return html.replace(
        '    <!-- LENTO_WEB_HEAD -->',
        target === 'web' ? webHead : '',
      )
    },
  }
}

function targetStaticAssetsPlugin(target: BuildTarget): Plugin {
  const manifestPath =
    target === 'extension'
      ? join(projectRoot, 'extension/manifest.json')
      : join(projectRoot, 'web/manifest.webmanifest')
  const manifestFileName =
    target === 'extension' ? 'manifest.json' : 'manifest.webmanifest'

  return {
    name: 'lento-target-static-assets',
    apply: 'build',
    buildStart() {
      for (const iconFileName of readdirSync(iconDirectory)) {
        this.emitFile({
          type: 'asset',
          fileName: `icons/${basename(iconFileName)}`,
          source: readFileSync(join(iconDirectory, iconFileName)),
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: manifestFileName,
        source: readFileSync(manifestPath),
      })
    },
  }
}

function withBase(base: string, fileName: string): string {
  return `${base}${fileName.replace(/^\//, '')}`
}

function webServiceWorkerPlugin(base: string): Plugin {
  return {
    name: 'lento-web-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const cacheHash = createHash('sha256')
      const precacheUrls = new Set<string>([
        base,
        withBase(base, 'index.html'),
      ])

      for (const [fileName, output] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue
        precacheUrls.add(withBase(base, fileName))
        cacheHash.update(fileName)
        cacheHash.update(
          output.type === 'chunk'
            ? output.code
            : typeof output.source === 'string'
              ? output.source
              : output.source,
        )
      }

      const cacheVersion = cacheHash.digest('hex').slice(0, 12)
      const appShellUrl = withBase(base, 'index.html')
      const serviceWorkerSource = `const CACHE_NAME = 'lento-app-${cacheVersion}'
const APP_SHELL_URL = ${JSON.stringify(appShellUrl)}
const PRECACHE_URLS = ${JSON.stringify([...precacheUrls].sort(), null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              cacheName.startsWith('lento-app-') && cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(APP_SHELL_URL)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse
      return fetch(request)
    }),
  )
})
`

      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: serviceWorkerSource,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const target = getBuildTarget(mode)
  const base = target === 'web' ? getWebBasePath() : '/'
  const plugins = [
    react(),
    targetHtmlPlugin(target, base),
    targetStaticAssetsPlugin(target),
  ]

  if (target === 'web') plugins.push(webServiceWorkerPlugin(base))

  return {
    base,
    publicDir: false,
    plugins,
    define: {
      __LENTO_BUILD_TARGET__: JSON.stringify(target),
    },
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      rollupOptions: {
        input:
          target === 'extension'
            ? {
                index: fileURLToPath(
                  new URL('./index.html', import.meta.url),
                ),
                background: fileURLToPath(
                  new URL('./src/background.ts', import.meta.url),
                ),
              }
            : fileURLToPath(new URL('./index.html', import.meta.url)),
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'background'
              ? 'background.js'
              : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
