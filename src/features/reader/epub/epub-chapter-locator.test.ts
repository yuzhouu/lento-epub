import { describe, expect, it } from 'vitest'
import type { TocItem } from '../../../types/book'
import {
  findChapterAtDocumentOffset,
  locateChapterRange,
  locateResourceChapters,
} from './epub-chapter-locator'
import { createChapterIndex } from './epub-navigation'

function createContentDocument(offsets: Record<string, number>): Document {
  let contentDocument: Document
  const anchors = new Map<string, Element>()
  const createElement = (top: number) =>
    ({
      getBoundingClientRect: () => ({ top }),
      get ownerDocument() {
        return contentDocument
      },
    }) as unknown as Element

  const body = createElement(0)
  contentDocument = {
    body,
    defaultView: { scrollY: 0 },
    getElementById: (fragment: string) => anchors.get(fragment) ?? null,
    getElementsByName: () => [] as unknown as NodeListOf<HTMLElement>,
  } as unknown as Document
  for (const [fragment, offset] of Object.entries(offsets)) {
    anchors.set(fragment, createElement(offset))
  }
  return contentDocument
}

const sharedResourceToc: TocItem[] = [
  { id: 'volume-1', href: 'text/journey.xhtml#volume-1', label: '上册' },
  { id: 'chapter-1', href: 'text/journey.xhtml#chapter-1', label: '第一回' },
  { id: 'chapter-2', href: 'text/journey.xhtml#chapter-2', label: '第二回' },
]

describe('EPUB chapter locator', () => {
  it('uses the same located boundary for a volume title and the first chapter', () => {
    const chapterIndex = createChapterIndex(sharedResourceToc)
    const contentDocument = createContentDocument({
      'volume-1': 100,
      'chapter-1': 168,
      'chapter-2': 1200,
    })

    expect(
      locateResourceChapters(
        contentDocument,
        chapterIndex,
        'OEBPS/text/journey.xhtml',
      ).map(({ chapter, offset }) => [chapter.item.label, offset]),
    ).toEqual([
      ['上册', 100],
      ['第一回', 168],
      ['第二回', 1200],
    ])
    expect(
      locateChapterRange(
        contentDocument,
        chapterIndex,
        'text/journey.xhtml#volume-1',
        2400,
      ),
    ).toMatchObject({
      chapter: { item: { label: '上册' } },
      nextChapter: { item: { label: '第一回' } },
      start: 100,
      end: 168,
    })
  })

  it('resolves the active chapter from the shared document offsets', () => {
    const chapterIndex = createChapterIndex(sharedResourceToc)
    const contentDocument = createContentDocument({
      'volume-1': 100,
      'chapter-1': 168,
      'chapter-2': 1200,
    })

    expect(
      findChapterAtDocumentOffset(
        contentDocument,
        chapterIndex,
        'text/journey.xhtml',
        800,
      )?.item.label,
    ).toBe('第一回')
  })
})
