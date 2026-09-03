import type { ReaderLocation, TocItem } from '../../../types/book'

export interface EpubChapterReference {
  item: TocItem
  order: number
  resourceHref: string
  fragment?: string
}

export interface EpubChapterRange {
  current: EpubChapterReference
  nextInResource?: EpubChapterReference
}

export interface EpubChapterIndex {
  chapters: readonly EpubChapterReference[]
  find: (
    href: string,
    preferredLabel?: string,
  ) => EpubChapterReference | undefined
  findNeighbors: (currentHref: string) => {
    previous?: EpubChapterReference
    next?: EpubChapterReference
  }
  findRange: (currentHref: string) => EpubChapterRange | undefined
  getChaptersInResource: (
    resourceHref: string,
  ) => readonly EpubChapterReference[]
}

export interface ParsedChapterHref {
  resourceHref: string
  fragment?: string
}

export function parseChapterHref(href: string): ParsedChapterHref {
  const fragmentIndex = href.indexOf('#')
  const resourceHref = fragmentIndex >= 0 ? href.slice(0, fragmentIndex) : href
  const encodedFragment = fragmentIndex >= 0 ? href.slice(fragmentIndex + 1) : ''
  if (!encodedFragment) return { resourceHref }
  try {
    return { resourceHref, fragment: decodeURIComponent(encodedFragment) }
  } catch {
    return { resourceHref, fragment: encodedFragment }
  }
}

function normalizeResourceHref(resourceHref: string): string {
  return resourceHref.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function isSameChapterResource(
  leftHref: string,
  rightHref: string,
): boolean {
  const leftPath = normalizeResourceHref(parseChapterHref(leftHref).resourceHref)
  const rightPath = normalizeResourceHref(
    parseChapterHref(rightHref).resourceHref,
  )
  return (
    leftPath === rightPath ||
    leftPath.endsWith(`/${rightPath}`) ||
    rightPath.endsWith(`/${leftPath}`)
  )
}

function isExactChapterReference(
  left: EpubChapterReference,
  right: EpubChapterReference,
): boolean {
  return (
    isSameChapterResource(left.resourceHref, right.resourceHref) &&
    left.fragment === right.fragment
  )
}

export function isSameChapterHref(
  currentHref: string,
  tocHref: string,
): boolean {
  return isSameChapterResource(currentHref, tocHref)
}

export function findChapterLabel(
  items: TocItem[],
  href: string,
  preferredLabel?: string,
): string | undefined {
  return findChapterItem(items, href, preferredLabel)?.label.trim()
}

export function flattenToc(items: TocItem[]): TocItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.subitems ? flattenToc(item.subitems) : []),
  ])
}

const chapterIndexCache = new WeakMap<TocItem[], EpubChapterIndex>()

export function createChapterIndex(items: TocItem[]): EpubChapterIndex {
  const chapters = flattenToc(items).map((item, order) => {
    const { resourceHref, fragment } = parseChapterHref(item.href)
    return { item, order, resourceHref, fragment }
  })
  const resourceCache = new Map<string, readonly EpubChapterReference[]>()

  function getChaptersInResource(
    resourceHref: string,
  ): readonly EpubChapterReference[] {
    const cached = resourceCache.get(resourceHref)
    if (cached) return cached
    const matches = chapters.filter((chapter) =>
      isSameChapterResource(resourceHref, chapter.resourceHref),
    )
    resourceCache.set(resourceHref, matches)
    return matches
  }

  function find(
    href: string,
    preferredLabel?: string,
  ): EpubChapterReference | undefined {
    const parsedHref = parseChapterHref(href)
    const sameResource = getChaptersInResource(parsedHref.resourceHref)
    const normalizedPreferredLabel = preferredLabel?.trim()
    const preferred = normalizedPreferredLabel
      ? sameResource.find(
          (chapter) =>
            chapter.item.label.trim() === normalizedPreferredLabel,
        )
      : undefined
    if (preferred) return preferred

    return (
      sameResource.find((chapter) => chapter.fragment === parsedHref.fragment) ??
      sameResource[0]
    )
  }

  function findNeighbors(currentHref: string) {
    const currentChapter = find(currentHref)
    if (!currentChapter) return {}

    const next = chapters
      .slice(currentChapter.order + 1)
      .find((chapter) => !isExactChapterReference(currentChapter, chapter))
    let previous: EpubChapterReference | undefined
    for (let index = currentChapter.order - 1; index >= 0; index -= 1) {
      if (!isExactChapterReference(currentChapter, chapters[index])) {
        previous = chapters[index]
        break
      }
    }

    return { previous, next }
  }

  function findRange(currentHref: string): EpubChapterRange | undefined {
    const current = find(currentHref)
    if (!current) return undefined
    const nextDistinctChapter = chapters
      .slice(current.order + 1)
      .find((chapter) => !isExactChapterReference(current, chapter))
    const nextInResource =
      nextDistinctChapter &&
      isSameChapterResource(
        current.resourceHref,
        nextDistinctChapter.resourceHref,
      )
        ? nextDistinctChapter
        : undefined
    return { current, nextInResource }
  }

  return {
    chapters,
    find,
    findNeighbors,
    findRange,
    getChaptersInResource,
  }
}

export function getChapterIndex(items: TocItem[]): EpubChapterIndex {
  const cached = chapterIndexCache.get(items)
  if (cached) return cached
  const index = createChapterIndex(items)
  chapterIndexCache.set(items, index)
  return index
}

export function findChapterItem(
  items: TocItem[],
  href: string,
  preferredLabel?: string,
): TocItem | undefined {
  return getChapterIndex(items).find(href, preferredLabel)?.item
}

export function findChapterNeighbors(
  items: TocItem[],
  currentHref: string,
): { previous?: TocItem; next?: TocItem } {
  const { previous, next } = getChapterIndex(items).findNeighbors(currentHref)
  return { previous: previous?.item, next: next?.item }
}

export function findChapterAnchorRange(
  items: TocItem[],
  currentHref: string,
): { startFragment?: string; endFragment?: string } {
  const range = getChapterIndex(items).findRange(currentHref)
  if (!range) return {}

  return {
    startFragment: range.current.fragment,
    endFragment: range.nextInResource?.fragment,
  }
}

export function findChapterAtOffset(
  items: TocItem[],
  resourceHref: string,
  offset: number,
  getFragmentOffset: (fragment: string) => number | undefined,
): TocItem | undefined {
  const chapterIndex = getChapterIndex(items)
  let currentChapter: TocItem | undefined
  let currentOffset = Number.NEGATIVE_INFINITY

  for (const chapter of chapterIndex.getChaptersInResource(resourceHref)) {
    const itemOffset = chapter.fragment
      ? getFragmentOffset(chapter.fragment)
      : 0
    if (
      itemOffset !== undefined &&
      itemOffset <= offset + 1 &&
      itemOffset >= currentOffset
    ) {
      currentChapter = chapter.item
      currentOffset = itemOffset
    }
  }

  return currentChapter
}

export function getChapterProgress(location: ReaderLocation): number {
  const displayed = location.start.displayed
  if (!displayed || displayed.total <= 0) return 0
  if (displayed.total === 1) return 1

  const page = Math.max(1, Math.min(displayed.total, displayed.page))
  return (page - 1) / (displayed.total - 1)
}
