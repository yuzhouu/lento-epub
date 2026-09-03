import type { EpubRendition } from './epub-types'
import { isSameChapterHref } from './epub-navigation'

export interface ChapterScrollProgress {
  progress: number
  atStart: boolean
  atEnd: boolean
  scrollSize: number
  viewportSize: number
}

export interface ChapterScrollRange {
  start: number
  end: number
}

interface RenderedView {
  document: Document
  element: HTMLElement
  resourceHref?: string
}

interface ContentScrollBridgeOptions {
  getChapterRange?: (view: RenderedView) => ChapterScrollRange | undefined
}

interface ActiveScrollRange {
  range: ChapterScrollRange
  constrained: boolean
}

export function getChapterScrollState(
  scrollTop: number,
  viewportHeight: number,
  range: ChapterScrollRange,
): ChapterScrollProgress & { scrollTop: number } {
  const rangeStart = Math.max(0, range.start)
  const rangeEnd = Math.max(rangeStart, range.end)
  const scrollSize = rangeEnd - rangeStart
  const viewportSize = Math.max(0, viewportHeight)
  const readableDistance = Math.max(
    0,
    scrollSize - viewportSize,
  )
  const nextScrollTop = Math.max(
    rangeStart,
    Math.min(rangeStart + readableDistance, scrollTop),
  )
  if (readableDistance === 0) {
    return {
      scrollTop: nextScrollTop,
      progress: 1,
      atStart: true,
      atEnd: true,
      scrollSize,
      viewportSize,
    }
  }

  const chapterOffset = nextScrollTop - rangeStart
  return {
    scrollTop: nextScrollTop,
    progress: chapterOffset / readableDistance,
    atStart: chapterOffset <= 1,
    atEnd: chapterOffset >= readableDistance - 1,
    scrollSize,
    viewportSize,
  }
}

export function getChapterScrollTopForProgress(
  progress: number,
  viewportHeight: number,
  range: ChapterScrollRange,
): number {
  const rangeStart = Math.max(0, range.start)
  const rangeEnd = Math.max(rangeStart, range.end)
  const normalizedProgress = Math.max(0, Math.min(1, progress))
  const readableDistance = Math.max(
    0,
    rangeEnd - rangeStart - Math.max(0, viewportHeight),
  )
  return rangeStart + normalizedProgress * readableDistance
}

export interface ContentScrollBridgeController {
  update: () => void
  scrollToProgress: (progress: number) => void
  scrollToChapter: (href: string) => boolean
  cleanup: () => void
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

function findChapterAnchor(
  contentDocument: Document,
  fragment: string,
): Element | undefined {
  return (
    contentDocument.getElementById(fragment) ??
    contentDocument.getElementsByName(fragment)[0]
  )
}

function getDocumentOffsetTop(element: Element): number {
  return (
    element.getBoundingClientRect().top +
    (element.ownerDocument.defaultView?.scrollY ?? 0)
  )
}

export function attachContentScrollBridge(
  rendition: EpubRendition,
  viewerElement: HTMLElement,
  onProgress: (progress: ChapterScrollProgress) => void,
  options: ContentScrollBridgeOptions = {},
): ContentScrollBridgeController {
  const contentDocuments = new Set<Document>()
  const renderedViews = new Map<HTMLElement, RenderedView>()
  const documentCleanups = new Map<Document, () => void>()
  let lastTouchY: number | undefined
  let scrollContainer: HTMLElement | undefined
  let progressFrame: number | undefined

  function getScrollContainer() {
    return viewerElement.querySelector<HTMLElement>('.epub-container')
  }

  function getActiveView(container: HTMLElement): RenderedView | undefined {
    const views = [...renderedViews.values()]
      .filter((view) => view.element.isConnected)
      .sort((a, b) => a.element.offsetTop - b.element.offsetTop)
    return (
      views.find(
        (view) =>
          container.scrollTop <
          view.element.offsetTop + view.element.offsetHeight,
      ) ?? views.at(-1)
    )
  }

  function getActiveRange(container: HTMLElement): ActiveScrollRange | undefined {
    const activeView = getActiveView(container)
    if (!activeView) return undefined
    const chapterRange = options.getChapterRange?.(activeView)
    return {
      range: chapterRange ?? {
        start: activeView.element.offsetTop,
        end: activeView.element.offsetTop + activeView.element.offsetHeight,
      },
      constrained: Boolean(chapterRange),
    }
  }

  function scrollBy(deltaY: number, event: Event) {
    const container = getScrollContainer()
    if (!container) return
    const previousScrollTop = container.scrollTop
    const activeRange = getActiveRange(container)
    if (!activeRange) return
    if (!activeRange.constrained) {
      container.scrollTop += deltaY
      if (container.scrollTop !== previousScrollTop) event.preventDefault()
      return
    }
    const nextState = getChapterScrollState(
      previousScrollTop + deltaY,
      container.clientHeight,
      activeRange.range,
    )
    container.scrollTop = nextState.scrollTop
    if (
      container.scrollTop !== previousScrollTop ||
      nextState.scrollTop !== previousScrollTop + deltaY
    ) {
      event.preventDefault()
    }
  }

  function update() {
    cancelAnimationFrame(progressFrame ?? 0)
    progressFrame = requestAnimationFrame(() => {
      const container = getScrollContainer()
      if (!container) return
      const activeRange = getActiveRange(container)
      if (!activeRange) {
        onProgress({
          progress: 0,
          atStart: false,
          atEnd: false,
          scrollSize: 0,
          viewportSize: container.clientHeight,
        })
        return
      }
      const nextState = getChapterScrollState(
        container.scrollTop,
        container.clientHeight,
        activeRange.range,
      )
      if (
        activeRange.constrained &&
        container.scrollTop !== nextState.scrollTop
      ) {
        container.scrollTop = nextState.scrollTop
      }
      onProgress({
        progress: nextState.progress,
        atStart: nextState.atStart,
        atEnd: nextState.atEnd,
        scrollSize: nextState.scrollSize,
        viewportSize: nextState.viewportSize,
      })
    })
  }

  function scrollToProgress(progress: number) {
    const container = getScrollContainer()
    if (!container) return
    const activeRange = getActiveRange(container)
    if (!activeRange) return
    container.scrollTop = getChapterScrollTopForProgress(
      progress,
      container.clientHeight,
      activeRange.range,
    )
    update()
  }

  function scrollToChapter(href: string): boolean {
    const container = getScrollContainer()
    if (!container) return false
    const connectedViews = [...renderedViews.values()].filter(
      (renderedView) => renderedView.element.isConnected,
    )
    let view = connectedViews.find(
      (renderedView) =>
        renderedView.resourceHref &&
        isSameChapterHref(renderedView.resourceHref, href),
    )
    const fragment = getChapterFragment(href)
    let anchor =
      fragment && view ? findChapterAnchor(view.document, fragment) : undefined
    if (fragment && !anchor) {
      for (const renderedView of connectedViews) {
        const matchingAnchor = findChapterAnchor(renderedView.document, fragment)
        if (!matchingAnchor) continue
        view = renderedView
        anchor = matchingAnchor
        break
      }
    }
    if (!view) return false
    if (fragment && !anchor) return false
    container.scrollTop =
      view.element.offsetTop + (anchor ? getDocumentOffsetTop(anchor) : 0)
    update()
    return true
  }

  function attach(
    section: { href?: string },
    view: { document?: Document; element?: HTMLElement },
  ) {
    const contentDocument = view.document
    if (!contentDocument || contentDocuments.has(contentDocument)) return
    contentDocuments.add(contentDocument)
    if (view.element) {
      renderedViews.set(view.element, {
        document: contentDocument,
        element: view.element,
        resourceHref: section.href,
      })
    }

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update)
    if (view.element) resizeObserver?.observe(view.element)

    const container = getScrollContainer()
    if (container && container !== scrollContainer) {
      scrollContainer?.removeEventListener('scroll', update)
      scrollContainer = container
      scrollContainer.addEventListener('scroll', update, { passive: true })
    }
    update()

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const currentContainer = getScrollContainer()
      if (!currentContainer) return
      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 18
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? currentContainer.clientHeight
            : 1
      scrollBy(event.deltaY * scale, event)
    }
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) lastTouchY = event.touches[0].clientY
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || lastTouchY === undefined) return
      const nextTouchY = event.touches[0].clientY
      scrollBy(lastTouchY - nextTouchY, event)
      lastTouchY = nextTouchY
    }
    const clearTouch = () => {
      lastTouchY = undefined
    }

    contentDocument.addEventListener('wheel', handleWheel, { passive: false })
    contentDocument.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    })
    contentDocument.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    })
    contentDocument.addEventListener('touchend', clearTouch, { passive: true })
    contentDocument.addEventListener('touchcancel', clearTouch, {
      passive: true,
    })
    documentCleanups.set(contentDocument, () => {
      contentDocument.removeEventListener('wheel', handleWheel)
      contentDocument.removeEventListener('touchstart', handleTouchStart)
      contentDocument.removeEventListener('touchmove', handleTouchMove)
      contentDocument.removeEventListener('touchend', clearTouch)
      contentDocument.removeEventListener('touchcancel', clearTouch)
      resizeObserver?.disconnect()
    })
  }

  rendition.on('rendered', attach)
  return {
    update,
    scrollToProgress,
    scrollToChapter,
    cleanup: () => {
      rendition.off('rendered', attach)
      scrollContainer?.removeEventListener('scroll', update)
      for (const cleanup of documentCleanups.values()) cleanup()
      cancelAnimationFrame(progressFrame ?? 0)
      contentDocuments.clear()
      renderedViews.clear()
      documentCleanups.clear()
    },
  }
}
