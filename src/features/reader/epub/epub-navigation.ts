import type { ReaderLocation, TocItem } from '../../../types/book'

function stripChapterFragment(href: string): string {
  return href.split('#')[0]
}

function getChapterFragment(href: string): string | undefined {
  const fragment = href.split('#')[1]
  if (!fragment) return undefined
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}

function isExactChapterHref(leftHref: string, rightHref: string): boolean {
  return (
    isSameChapterHref(leftHref, rightHref) &&
    getChapterFragment(leftHref) === getChapterFragment(rightHref)
  )
}

export function isSameChapterHref(
  currentHref: string,
  tocHref: string,
): boolean {
  const currentPath = stripChapterFragment(currentHref)
  const tocPath = stripChapterFragment(tocHref)
  return (
    currentPath === tocPath ||
    currentPath.endsWith(tocPath) ||
    tocPath.endsWith(currentPath)
  )
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

export function findChapterItem(
  items: TocItem[],
  href: string,
  preferredLabel?: string,
): TocItem | undefined {
  const chapters = flattenToc(items)
  const sameResource = chapters.filter((item) =>
    isSameChapterHref(href, item.href),
  )
  const normalizedPreferredLabel = preferredLabel?.trim()
  const preferred = normalizedPreferredLabel
    ? sameResource.find(
        (item) => item.label.trim() === normalizedPreferredLabel,
      )
    : undefined
  if (preferred) return preferred

  return (
    chapters.find((item) => isExactChapterHref(href, item.href)) ??
    sameResource[0]
  )
}

export function findChapterNeighbors(
  items: TocItem[],
  currentHref: string,
): { previous?: TocItem; next?: TocItem } {
  const chapters = flattenToc(items)
  const currentChapter = findChapterItem(items, currentHref)
  const currentIndex = currentChapter
    ? chapters.indexOf(currentChapter)
    : -1
  if (!currentChapter || currentIndex < 0) return {}

  const next = chapters
    .slice(currentIndex + 1)
    .find((item) => !isExactChapterHref(currentChapter.href, item.href))
  let previous: TocItem | undefined
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!isExactChapterHref(currentChapter.href, chapters[index].href)) {
      previous = chapters[index]
      break
    }
  }

  return { previous, next }
}

export function findChapterAnchorRange(
  items: TocItem[],
  currentHref: string,
): { startFragment?: string; endFragment?: string } {
  const chapters = flattenToc(items)
  const currentChapter = findChapterItem(items, currentHref)
  if (!currentChapter) return {}

  const currentIndex = chapters.indexOf(currentChapter)
  const nextDistinctChapter = chapters
    .slice(currentIndex + 1)
    .find((item) => !isExactChapterHref(currentChapter.href, item.href))
  const nextChapterInResource =
    nextDistinctChapter &&
    isSameChapterHref(currentChapter.href, nextDistinctChapter.href)
      ? nextDistinctChapter
      : undefined

  return {
    startFragment: getChapterFragment(currentChapter.href),
    endFragment: nextChapterInResource
      ? getChapterFragment(nextChapterInResource.href)
      : undefined,
  }
}

export function findChapterAtOffset(
  items: TocItem[],
  resourceHref: string,
  offset: number,
  getFragmentOffset: (fragment: string) => number | undefined,
): TocItem | undefined {
  let currentChapter: TocItem | undefined
  let currentOffset = Number.NEGATIVE_INFINITY

  for (const item of flattenToc(items)) {
    if (!isSameChapterHref(resourceHref, item.href)) continue
    const fragment = getChapterFragment(item.href)
    const itemOffset = fragment ? getFragmentOffset(fragment) : 0
    if (
      itemOffset !== undefined &&
      itemOffset <= offset + 1 &&
      itemOffset >= currentOffset
    ) {
      currentChapter = item
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
