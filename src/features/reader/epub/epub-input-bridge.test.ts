import { describe, expect, it } from 'vitest'
import {
  getChapterScrollState,
  getChapterScrollTopForProgress,
} from './epub-input-bridge'

describe('EPUB chapter scroll boundaries', () => {
  it('measures progress inside an anchored chapter range', () => {
    const range = { start: 800, end: 4800 }

    expect(getChapterScrollState(800, 1000, range)).toEqual({
      scrollTop: 800,
      progress: 0,
      atStart: true,
      atEnd: false,
      scrollSize: 4000,
      viewportSize: 1000,
    })
    expect(getChapterScrollState(2300, 1000, range)).toEqual({
      scrollTop: 2300,
      progress: 0.5,
      atStart: false,
      atEnd: false,
      scrollSize: 4000,
      viewportSize: 1000,
    })
    expect(getChapterScrollState(3800, 1000, range)).toEqual({
      scrollTop: 3800,
      progress: 1,
      atStart: false,
      atEnd: true,
      scrollSize: 4000,
      viewportSize: 1000,
    })
  })

  it('clamps scrolling to the current chapter', () => {
    const range = { start: 800, end: 4800 }

    expect(getChapterScrollState(200, 1000, range).scrollTop).toBe(800)
    expect(getChapterScrollState(5000, 1000, range).scrollTop).toBe(3800)
  })

  it('maps the proxy scrollbar position back into the chapter range', () => {
    const range = { start: 800, end: 4800 }

    expect(getChapterScrollTopForProgress(0, 1000, range)).toBe(800)
    expect(getChapterScrollTopForProgress(0.5, 1000, range)).toBe(2300)
    expect(getChapterScrollTopForProgress(1, 1000, range)).toBe(3800)
    expect(getChapterScrollTopForProgress(2, 1000, range)).toBe(3800)
  })

  it('treats a short chapter as both its start and end', () => {
    expect(getChapterScrollState(1200, 1000, { start: 800, end: 1400 })).toEqual(
      {
        scrollTop: 800,
        progress: 1,
        atStart: true,
        atEnd: true,
        scrollSize: 600,
        viewportSize: 1000,
      },
    )
  })
})
