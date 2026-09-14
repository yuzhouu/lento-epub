import { renderToStaticMarkup } from 'react-dom/server'
import { AboutPage } from '../components/about/AboutPage'
import { PrivacyPage } from '../components/privacy/PrivacyPage'
import { LibraryPage } from '../components/library/LibraryPage'
import i18n from '../i18n'
import type { PublicPage } from '../lib/app-route'
import { getPageMetadata, getStructuredData } from './metadata'

const ignore = () => undefined
const ignoreAsync = async () => undefined

export async function renderPublicPages() {
  await i18n.changeLanguage('zh-CN')
  const t = i18n.getFixedT('zh-CN')
  const pages: PublicPage[] = ['library', 'about', 'privacy']
  return pages.map((page) => {
    const content = page === 'about' ? <AboutPage /> : page === 'privacy' ? <PrivacyPage /> : (
      <LibraryPage
        books={[]}
        libraryNotice={undefined}
        isImporting={false}
        onImportFiles={ignoreAsync}
        onLibraryNoticeChange={ignore}
        onRestored={ignore}
        onDelete={ignoreAsync}
        onUndoDelete={ignoreAsync}
        onUpdateBook={ignoreAsync}
        onOpen={ignore}
      />
    )
    const metadata = getPageMetadata(page, t, __LENTO_SITE_URL__)
    const structuredData = getStructuredData(page, metadata, __LENTO_SITE_URL__, 'zh-CN')
    return {
      fileName: page === 'library' ? 'index.html' : `${page}/index.html`,
      url: metadata.url,
      body: renderToStaticMarkup(content),
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
  })
}
