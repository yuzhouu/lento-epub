import { describe, expect, it } from 'vitest'
import { resolveAppRoute } from './app-route'

describe('public pages and local reader routes', () => {
  it.each(['/', '/lento-epub/'])('supports direct static pages under %s', (base) => {
    for (const page of ['about', 'privacy']) {
      for (const suffix of ['', '/', '/index.html']) {
        expect(resolveAppRoute(`${base}${page}${suffix}`, '', base)).toEqual({ page })
      }
    }
    expect(resolveAppRoute(base, '', base)).toEqual({ page: 'library' })
  })

  it('keeps old extension links and local book bookmarks usable', () => {
    expect(resolveAppRoute('/index.html', '#/about', '/')).toEqual({ page: 'about' })
    expect(resolveAppRoute('/lento-epub/', '#/privacy', '/lento-epub/')).toEqual({ page: 'privacy' })
    expect(resolveAppRoute('/lento-epub/', '#/book/a%2Fb', '/lento-epub/'))
      .toEqual({ page: 'reader', bookId: 'a/b' })
    expect(resolveAppRoute('/lento-epub/', '#/book/%broken', '/lento-epub/'))
      .toEqual({ page: 'library' })
  })
})
