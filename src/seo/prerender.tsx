import { text } from 'node:stream/consumers'
import { StrictMode } from 'react'
import { prerenderToNodeStream } from 'react-dom/static'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from '../App'
import i18n from '../i18n'
import type { PublicPage } from '../lib/app-route'
import { getPageMetadata, getStructuredData } from './metadata'
import { PRERENDER_LANGUAGE } from './hydration'

export async function renderPublicPages() {
  await i18n.changeLanguage(PRERENDER_LANGUAGE)
  const t = i18n.getFixedT(PRERENDER_LANGUAGE)
  const pages: PublicPage[] = ['library', 'about', 'privacy']
  return Promise.all(pages.map(async (page) => {
    const { prelude } = await prerenderToNodeStream(
      <StrictMode><App initialRoute={{ page }} /></StrictMode>,
    )
    const metadata = getPageMetadata(page, t, __LENTO_SITE_URL__)
    const structuredData = getStructuredData(page, metadata, __LENTO_SITE_URL__, PRERENDER_LANGUAGE)
    return {
      page,
      fileName: page === 'library' ? 'index.html' : `${page}/index.html`,
      url: metadata.url,
      body: await text(prelude),
      // Metadata and the no-JavaScript notice live outside the hydrated root.
      head: renderToStaticMarkup(<>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={metadata.url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="卷舍 · Lento" />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:url" content={metadata.url} />
        <meta property="og:locale" content="zh_CN" />
        <meta property="og:image" content={metadata.image} />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="卷舍 · Lento" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content={metadata.image} />
        <script type="application/ld+json" id="lento-structured-data" dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }} />
      </>),
      notice: renderToStaticMarkup(<noscript><p className="javascript-notice">{t('seo.javascriptNotice')}</p></noscript>),
    }
  }))
}
