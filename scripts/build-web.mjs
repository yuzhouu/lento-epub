import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, resolveConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { checkSeo } from './check-seo.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = await resolveConfig({ root, mode: 'web' }, 'build', 'production', 'production')
assert.ok(config.isProduction, 'Build the website with NODE_ENV=production.')
const output = join(root, config.build.outDir)
// Keep the temporary module under node_modules so SSR externals resolve normally.
const rendererDirectory = join(root, 'node_modules/.cache/lento-prerender')

try {
  await build({ root, mode: 'web' })
  await build({
    configFile: false,
    root,
    base: config.base,
    plugins: [react()],
    define: config.define,
    publicDir: false,
    build: {
      ssr: 'src/seo/prerender.tsx',
      outDir: rendererDirectory,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'render.mjs' } },
    },
  })
  const { renderPublicPages } = await import(pathToFileURL(join(rendererDirectory, 'render.mjs')).href)
  const pages = await renderPublicPages()
  const shell = await readFile(join(output, 'index.html'), 'utf8')
  for (const page of pages) {
    const html = shell
      .replace(/<title>[\s\S]*?<\/title>/, page.head)
      .replace('<div id="root"></div>', `<div id="root" data-prerendered-page="${page.page}">${page.body}</div>${page.notice}`)
    const path = join(output, page.fileName)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, html)
  }

  const escapeXml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  await writeFile(join(output, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${escapeXml(page.url)}</loc></url>`).join('\n')}\n</urlset>\n`)
  const siteUrl = pages[0].url
  await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`)
  // GitHub Pages must serve generated directories and assets without Jekyll processing.
  await writeFile(join(output, '.nojekyll'), '')
  await writeServiceWorker(output, config.base)
  await checkSeo(output, config.base, siteUrl)
  console.log(`Prerendered ${pages.length} public pages, sitemap, robots.txt, and offline cache.`)
} finally {
  await rm(rendererDirectory, { recursive: true, force: true })
}

async function writeServiceWorker(directory, base) {
  const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
    .filter((file) => !file.endsWith('.map') && !['.nojekyll', 'robots.txt', 'sitemap.xml', 'service-worker.js'].includes(file))
    .sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update(await readFile(join(directory, file)))
  }
  const precacheUrls = files.map((file) => `${base}${file}`)
  const source = `const CACHE_NAME = 'lento-app-${hash.digest('hex').slice(0, 12)}'
const APP_SHELL_URL = ${JSON.stringify(`${base}index.html`)}
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(PRECACHE_URLS))
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names
      .filter((name) => name.startsWith('lento-app-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    const pageUrl = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(pageUrl)) || (await caches.match(APP_SHELL_URL))))
    return
  }
  // These are immutable build assets. Preview/CDN CORS Vary headers must not
  // make the same asset disappear from the offline cache for module requests.
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) =>
    (await cache.match(request, { ignoreVary: true })) || fetch(request)))
})
`
  await writeFile(join(directory, 'service-worker.js'), source)
}
