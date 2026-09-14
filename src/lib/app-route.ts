export type PublicPage = 'library' | 'about' | 'privacy'
export type AppRoute =
  | { page: PublicPage }
  | { page: 'reader'; bookId: string }

export function getPageHref(page: PublicPage): string {
  if (__LENTO_BUILD_TARGET__ === 'extension') {
    return page === 'library' ? '#/' : `#/${page}`
  }
  return `${import.meta.env.BASE_URL}${page === 'library' ? '' : `${page}/`}`
}

export function resolveAppRoute(
  pathname: string,
  hash: string,
  base: string,
): AppRoute {
  if (hash === '#/about') return { page: 'about' }
  if (hash === '#/privacy') return { page: 'privacy' }
  const book = hash.match(/^#\/book\/(.+)$/)
  if (book) {
    try {
      return { page: 'reader', bookId: decodeURIComponent(book[1]) }
    } catch {
      return { page: 'library' }
    }
  }
  if (hash === '#/') return { page: 'library' }
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  if (/^about(?:\/|\/index\.html)?$/.test(path)) return { page: 'about' }
  if (/^privacy(?:\/|\/index\.html)?$/.test(path)) return { page: 'privacy' }
  return { page: 'library' }
}

export function normalizeLegacyPublicRoute(): boolean {
  if (__LENTO_BUILD_TARGET__ !== 'web') return false
  const page = window.location.hash === '#/about'
    ? 'about'
    : window.location.hash === '#/privacy' ? 'privacy' : undefined
  if (page) {
    window.location.replace(`${getPageHref(page)}${window.location.search}`)
    return true
  }
  return false
}
