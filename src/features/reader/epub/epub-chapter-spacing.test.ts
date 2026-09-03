import { describe, expect, it } from 'vitest'
import { getMinimumChapterSpacerHeight } from './epub-chapter-spacing'

describe('EPUB minimum chapter height', () => {
  it('fills a short chapter to one viewport', () => {
    expect(getMinimumChapterSpacerHeight(120, 168, 736)).toBe(688)
  })

  it('does not add space to a chapter that already fills the viewport', () => {
    expect(getMinimumChapterSpacerHeight(120, 900, 736)).toBe(0)
  })

  it('rounds fractional layout gaps up to avoid exposing the next chapter', () => {
    expect(getMinimumChapterSpacerHeight(0.4, 500.8, 501)).toBe(1)
  })
})
