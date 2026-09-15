import type { PublicPage } from '../lib/app-route'

export const PRERENDER_LANGUAGE = 'zh-CN'

export function getPrerenderedPage(root: Element | null): PublicPage | undefined {
  const page = root?.getAttribute('data-prerendered-page')
  return page === 'library' || page === 'about' || page === 'privacy'
    ? page
    : undefined
}
