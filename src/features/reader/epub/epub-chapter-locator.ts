import type {
  EpubChapterIndex,
  EpubChapterReference,
} from './epub-navigation'

export interface LocatedChapterStart {
  chapter: EpubChapterReference
  anchor: Element
  offset: number
}

export interface LocatedChapterRange {
  chapter: EpubChapterReference
  nextChapter?: EpubChapterReference
  startAnchor: Element
  endAnchor?: Element
  start: number
  end: number
}

export function getDocumentOffsetTop(element: Element): number {
  return (
    element.getBoundingClientRect().top +
    (element.ownerDocument.defaultView?.scrollY ?? 0)
  )
}

export function findChapterAnchor(
  contentDocument: Document,
  chapter: EpubChapterReference,
): Element | undefined {
  if (!chapter.fragment) return contentDocument.body ?? undefined
  return (
    contentDocument.getElementById(chapter.fragment) ??
    contentDocument.getElementsByName(chapter.fragment)[0]
  )
}

export function locateChapterStart(
  contentDocument: Document,
  chapter: EpubChapterReference,
): LocatedChapterStart | undefined {
  const anchor = findChapterAnchor(contentDocument, chapter)
  if (!anchor) return undefined
  return {
    chapter,
    anchor,
    offset: chapter.fragment ? getDocumentOffsetTop(anchor) : 0,
  }
}

export function locateResourceChapters(
  contentDocument: Document,
  chapterIndex: EpubChapterIndex,
  resourceHref: string,
): LocatedChapterStart[] {
  const seenAnchors = new Set<Element>()
  const located: LocatedChapterStart[] = []
  for (const chapter of chapterIndex.getChaptersInResource(resourceHref)) {
    const start = locateChapterStart(contentDocument, chapter)
    if (!start || seenAnchors.has(start.anchor)) continue
    seenAnchors.add(start.anchor)
    located.push(start)
  }
  return located
}

export function locateChapterRange(
  contentDocument: Document,
  chapterIndex: EpubChapterIndex,
  currentHref: string,
  documentEnd: number,
): LocatedChapterRange | undefined {
  const range = chapterIndex.findRange(currentHref)
  if (!range) return undefined
  if (!range.current.fragment && !range.nextInResource?.fragment) {
    return undefined
  }

  const start = locateChapterStart(contentDocument, range.current)
  const end = range.nextInResource
    ? locateChapterStart(contentDocument, range.nextInResource)
    : undefined
  if (!start || (range.nextInResource && !end)) return undefined

  return {
    chapter: range.current,
    nextChapter: range.nextInResource,
    startAnchor: start.anchor,
    endAnchor: end?.anchor,
    start: start.offset,
    end: end?.offset ?? documentEnd,
  }
}

export function findChapterAtDocumentOffset(
  contentDocument: Document,
  chapterIndex: EpubChapterIndex,
  resourceHref: string,
  offset: number,
): EpubChapterReference | undefined {
  let current: LocatedChapterStart | undefined
  for (const chapter of locateResourceChapters(
    contentDocument,
    chapterIndex,
    resourceHref,
  )) {
    if (
      chapter.offset <= offset + 1 &&
      chapter.offset >= (current?.offset ?? -Infinity)
    ) {
      current = chapter
    }
  }
  return current?.chapter
}
