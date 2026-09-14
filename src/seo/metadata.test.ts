import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { getPageMetadata, normalizeSiteUrl } from './metadata'

describe('public search metadata', () => {
  it('resolves every canonical URL inside the deployed site', () => {
    for (const site of ['https://yuzhouu.github.io/lento-epub/', 'https://books.example.com/']) {
      const t = i18n.getFixedT('zh-CN')
      expect(getPageMetadata('library', t, site).url).toBe(site)
      expect(getPageMetadata('about', t, site).url).toBe(`${site}about/`)
      expect(getPageMetadata('privacy', t, site).url).toBe(`${site}privacy/`)
      expect(getPageMetadata('library', t, site).title).toContain('EPUB')
    }
  })

  it('normalizes public deployment URLs and rejects local or ambiguous URLs', () => {
    expect(normalizeSiteUrl('https://example.com/books')).toBe('https://example.com/books/')
    for (const url of [
      'http://localhost:4321/', 'https://localhost/', 'https://127.0.0.1/',
      'https://[::1]/', 'https://example.com/?a=b', 'https://example.com/#about',
      'https://user:password@example.com/',
    ]) expect(() => normalizeSiteUrl(url)).toThrow()
  })
})
