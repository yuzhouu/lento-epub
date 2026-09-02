import type { ReaderLocation, TocItem } from '../../../types/book'

function stripChapterFragment(href: string): string {
  return href.split('#')[0]
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
): string | undefined {
  for (const item of items) {
    if (isSameChapterHref(href, item.href)) return item.label.trim()
    const nested = item.subitems
      ? findChapterLabel(item.subitems, href)
      : undefined
    if (nested) return nested
  }
  return undefined
}

function flattenToc(items: TocItem[]): TocItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.subitems ? flattenToc(item.subitems) : []),
  ])
}

export function findChapterNeighbors(
  items: TocItem[],
  currentHref: string,
): { previous?: TocItem; next?: TocItem } {
  const chapters = flattenToc(items)
  const currentIndex = chapters.findIndex((item) =>
    isSameChapterHref(currentHref, item.href),
  )
  if (currentIndex < 0) return {}

  const next = chapters
    .slice(currentIndex + 1)
    .find((item) => !isSameChapterHref(currentHref, item.href))
  let previous: TocItem | undefined
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!isSameChapterHref(currentHref, chapters[index].href)) {
      previous = chapters[index]
      break
    }
  }

  return { previous, next }
}

export function getChapterProgress(location: ReaderLocation): number {
  const displayed = location.start.displayed
  if (!displayed || displayed.total <= 0) return 0
  if (displayed.total === 1) return 1

  const page = Math.max(1, Math.min(displayed.total, displayed.page))
  return (page - 1) / (displayed.total - 1)
}
