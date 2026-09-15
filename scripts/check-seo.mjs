import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function checkSeo(directory, base, siteUrl) {
  const urls = []
  for (const route of ['', 'about/', 'privacy/']) {
    const html = await readFile(join(directory, route, 'index.html'), 'utf8')
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    const body = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? ''
    const page = route ? route.slice(0, -1) : 'library'
    assert.ok(html.includes(`data-prerendered-page="${page}"`), `${route} is missing its hydration route`)
    if (page === 'library') {
      assert.ok(body.includes('aria-busy="true"'), 'The initial library must wait for local books')
      assert.ok(!body.includes('这里还没有书'), 'The initial HTML must not claim that the local library is empty')
    }
    assert.ok(body.replace(/<[^>]*>/g, '').length > 150, `${route} has no readable static body`)
    assert.ok(body.includes('EPUB'), `${route} omits the product description`)
    assert.equal((head.match(/<title>/g) ?? []).length, 1)
    assert.ok(head.includes('name="description"'))
    assert.ok(!head.includes('noindex'))
    const canonical = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)]
    assert.equal(canonical.length, 1)
    assert.equal(canonical[0][1], `${siteUrl}${route}`)
    urls.push(canonical[0][1])
    const graph = JSON.parse(head.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '{}')
    assert.equal(graph['@context'], 'https://schema.org')
    assert.ok(graph['@graph'].some((item) => item.url === canonical[0][1]))
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1]
      if (!url.startsWith('/')) continue
      assert.ok(url.startsWith(base), `Asset or page link escapes the base: ${url}`)
      const file = decodeURIComponent(url.slice(base.length))
      await access(join(directory, file, file.endsWith('/') || !file ? 'index.html' : ''))
    }
    assert.ok(!html.includes('href="#/about"') && !html.includes('href="#/privacy"'))
  }
  const sitemap = await readFile(join(directory, 'sitemap.xml'), 'utf8')
  const entries = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(entries, urls)
  const robots = await readFile(join(directory, 'robots.txt'), 'utf8')
  assert.ok(robots.includes(`Sitemap: ${siteUrl}sitemap.xml`))
  assert.ok(!robots.includes('Disallow: /'))
  const worker = await readFile(join(directory, 'service-worker.js'), 'utf8')
  for (const route of ['', 'about/', 'privacy/']) {
    assert.ok(worker.includes(`${base}${route}index.html`), `Offline cache misses ${route}`)
  }
  const scriptFiles = (await readdir(join(directory, 'assets'))).filter((file) => file.endsWith('.js'))
  const scripts = await Promise.all(scriptFiles.map((file) => readFile(join(directory, 'assets', file), 'utf8')))
  assert.ok(scripts.some((script) => script.includes('service-worker.js')), 'Production Service Worker registration is missing')
  assert.ok(!scripts.some((script) => script.includes('Download the React DevTools')), 'The website contains a development React build')
  console.log('SEO checks passed: static content, canonical URLs, structured data, assets, sitemap, and offline pages.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const { resolveConfig } = await import('vite')
  const config = await resolveConfig({ root, mode: 'web' }, 'build')
  await checkSeo(join(root, config.build.outDir), config.base, JSON.parse(config.define.__LENTO_SITE_URL__))
}
