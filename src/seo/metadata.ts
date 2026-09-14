import type { TFunction } from 'i18next'
import type { PublicPage } from '../lib/app-route.ts'

export const DEFAULT_SITE_URL = 'https://yuzhouu.github.io/lento-epub/'

export function normalizeSiteUrl(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' || url.username || url.password ||
    url.search || url.hash || url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]'
  ) {
    throw new Error('LENTO_SITE_URL must be a public HTTPS URL without credentials, query, or hash.')
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

export function getPageMetadata(page: PublicPage, t: TFunction, siteUrl: string) {
  const url = new URL(page === 'library' ? '' : `${page}/`, siteUrl).href
  return {
    title: t(page === 'library' ? 'app.homeTitle' : `app.${page}Title`),
    description: t(page === 'privacy' ? 'privacy.intro' : 'seo.description'),
    url,
    image: new URL('icons/lento-512.png', siteUrl).href,
  }
}

export function getStructuredData(
  page: PublicPage,
  metadata: ReturnType<typeof getPageMetadata>,
  siteUrl: string,
  language: string,
) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite', '@id': `${siteUrl}#website`,
        name: '卷舍 · Lento', url: siteUrl, inLanguage: language,
      },
      {
        '@type': page === 'about' ? 'AboutPage' : 'WebPage',
        '@id': metadata.url, url: metadata.url, name: metadata.title,
        description: metadata.description, inLanguage: language,
        isPartOf: { '@id': `${siteUrl}#website` },
      },
      ...(page === 'library' ? [{
        '@type': 'SoftwareApplication', name: '卷舍 · Lento',
        url: siteUrl, description: metadata.description,
        applicationCategory: 'EducationalApplication', operatingSystem: 'Web',
        image: metadata.image,
      }] : []),
    ],
  }
}

const OPEN_GRAPH_LOCALES: Record<string, string> = {
  'zh-CN': 'zh_CN', en: 'en_US', ja: 'ja_JP',
  ru: 'ru_RU', fr: 'fr_FR', es: 'es_ES',
}

export function updatePageMetadata(page: PublicPage, t: TFunction, language: string): void {
  const metadata = getPageMetadata(page, t, __LENTO_SITE_URL__)
  document.title = metadata.title
  if (__LENTO_BUILD_TARGET__ !== 'web') return

  const entries = {
    'name:description': metadata.description,
    'property:og:title': metadata.title,
    'property:og:description': metadata.description,
    'property:og:url': metadata.url,
    'property:og:image': metadata.image,
    'property:og:locale': OPEN_GRAPH_LOCALES[language] ?? 'zh_CN',
    'name:twitter:title': metadata.title,
    'name:twitter:description': metadata.description,
    'name:twitter:image': metadata.image,
  }
  for (const [selector, content] of Object.entries(entries)) {
    const attribute = selector.slice(0, selector.indexOf(':'))
    const name = selector.slice(attribute.length + 1)
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, name)
      document.head.append(element)
    }
    element.content = content
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = metadata.url
  let structuredData = document.head.querySelector<HTMLScriptElement>('#lento-structured-data')
  if (!structuredData) {
    structuredData = document.createElement('script')
    structuredData.id = 'lento-structured-data'
    structuredData.type = 'application/ld+json'
    document.head.append(structuredData)
  }
  structuredData.textContent = JSON.stringify(getStructuredData(page, metadata, __LENTO_SITE_URL__, language))
}
