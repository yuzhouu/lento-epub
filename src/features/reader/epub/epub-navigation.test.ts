import { describe, expect, it } from 'vitest'
import type { ReaderLocation, TocItem } from '../../../types/book'
import {
  findChapterLabel,
  findChapterNeighbors,
  getChapterProgress,
  isSameChapterHref,
} from './epub-navigation'

const toc: TocItem[] = [
  { id: 'cover', href: 'text/cover.xhtml', label: '封面' },
  {
    id: 'part-1',
    href: 'text/part-1.xhtml',
    label: '上篇',
    subitems: [
      { id: 'chapter-1', href: 'text/chapter-1.xhtml#start', label: '第一章' },
      { id: 'chapter-2', href: 'text/chapter-2.xhtml', label: '第二章' },
    ],
  },
]

describe('EPUB navigation', () => {
  it('matches chapter paths independently of fragments and base paths', () => {
    expect(
      isSameChapterHref(
        '/OPS/text/chapter-1.xhtml#paragraph-3',
        'text/chapter-1.xhtml#start',
      ),
    ).toBe(true)
    expect(findChapterLabel(toc, 'OPS/text/chapter-2.xhtml#p4')).toBe('第二章')
  })

  it('flattens nested chapters when finding neighbors', () => {
    const neighbors = findChapterNeighbors(toc, 'text/chapter-1.xhtml#p2')
    expect(neighbors.previous?.label).toBe('上篇')
    expect(neighbors.next?.label).toBe('第二章')
  })

  it('normalizes displayed page progress and guards invalid totals', () => {
    const location = (page: number, total: number): ReaderLocation => ({
      start: {
        cfi: 'epubcfi(/6/2)',
        href: 'text/chapter-1.xhtml',
        displayed: { page, total },
      },
    })

    expect(getChapterProgress(location(1, 5))).toBe(0)
    expect(getChapterProgress(location(3, 5))).toBe(0.5)
    expect(getChapterProgress(location(9, 5))).toBe(1)
    expect(getChapterProgress(location(1, 0))).toBe(0)
  })
})
