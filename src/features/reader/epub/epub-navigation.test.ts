import { describe, expect, it } from 'vitest'
import type { ReaderLocation, TocItem } from '../../../types/book'
import {
  findChapterAtOffset,
  findChapterAnchorRange,
  findChapterItem,
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

const anchoredToc: TocItem[] = [
  { id: 'journey', href: 'text/journey.xhtml', label: '西游记' },
  { id: 'chapter-1', href: 'text/journey.xhtml#chapter-1', label: '第一回' },
  { id: 'chapter-2', href: 'text/journey.xhtml#chapter-2', label: '第二回' },
  { id: 'chapter-3', href: 'text/journey.xhtml#chapter-3', label: '第三回' },
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

  it('keeps anchored chapters distinct inside one content document', () => {
    expect(
      findChapterItem(anchoredToc, 'OPS/text/journey.xhtml#chapter-2')?.label,
    ).toBe('第二回')
    expect(
      findChapterItem(
        anchoredToc,
        'OPS/text/journey.xhtml',
        '第三回',
      )?.href,
    ).toBe('text/journey.xhtml#chapter-3')
    expect(
      findChapterLabel(
        anchoredToc,
        'OPS/text/journey.xhtml',
        '第二回',
      ),
    ).toBe('第二回')

    const neighbors = findChapterNeighbors(
      anchoredToc,
      'OPS/text/journey.xhtml#chapter-2',
    )
    expect(neighbors.previous?.label).toBe('第一回')
    expect(neighbors.next?.label).toBe('第三回')
  })

  it('finds the anchor range for one chapter in a shared document', () => {
    expect(
      findChapterAnchorRange(
        anchoredToc,
        'OPS/text/journey.xhtml#chapter-2',
      ),
    ).toEqual({
      startFragment: 'chapter-2',
      endFragment: 'chapter-3',
    })
    expect(
      findChapterAnchorRange(
        anchoredToc,
        'OPS/text/journey.xhtml#chapter-3',
      ),
    ).toEqual({ startFragment: 'chapter-3', endFragment: undefined })
  })

  it('resolves a saved position to the nearest preceding chapter anchor', () => {
    const anchorOffsets = new Map([
      ['chapter-1', 100],
      ['chapter-2', 1200],
      ['chapter-3', 2500],
    ])

    expect(
      findChapterAtOffset(
        anchoredToc,
        'OPS/text/journey.xhtml',
        1800,
        (fragment) => anchorOffsets.get(fragment),
      )?.label,
    ).toBe('第二回')
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
