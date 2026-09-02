import type { EpubRendition } from './epub-types'

export interface ChapterScrollProgress {
  progress: number
  atStart: boolean
  atEnd: boolean
}

export function attachContentScrollBridge(
  rendition: EpubRendition,
  viewerElement: HTMLElement,
  onProgress: (progress: ChapterScrollProgress) => void,
): { update: () => void; cleanup: () => void } {
  const contentDocuments = new Set<Document>()
  const renderedViews = new Set<HTMLElement>()
  const documentCleanups = new Map<Document, () => void>()
  let lastTouchY: number | undefined
  let scrollContainer: HTMLElement | undefined
  let progressFrame: number | undefined

  function getScrollContainer() {
    return viewerElement.querySelector<HTMLElement>('.epub-container')
  }

  function scrollBy(deltaY: number, event: Event) {
    const container = getScrollContainer()
    if (!container) return
    const previousScrollTop = container.scrollTop
    container.scrollTop += deltaY
    if (container.scrollTop !== previousScrollTop) event.preventDefault()
  }

  function update() {
    cancelAnimationFrame(progressFrame ?? 0)
    progressFrame = requestAnimationFrame(() => {
      const container = getScrollContainer()
      if (!container) return

      const views = [...renderedViews]
        .filter((element) => element.isConnected)
        .sort((a, b) => a.offsetTop - b.offsetTop)
      const activeView =
        views.find(
          (element) =>
            container.scrollTop < element.offsetTop + element.offsetHeight,
        ) ?? views.at(-1)
      if (!activeView) {
        onProgress({ progress: 0, atStart: false, atEnd: false })
        return
      }

      const readableDistance = Math.max(
        0,
        activeView.offsetHeight - container.clientHeight,
      )
      if (readableDistance === 0) {
        onProgress({ progress: 1, atStart: true, atEnd: true })
        return
      }

      const chapterOffset = Math.max(
        0,
        Math.min(
          readableDistance,
          container.scrollTop - activeView.offsetTop,
        ),
      )
      onProgress({
        progress: chapterOffset / readableDistance,
        atStart: chapterOffset <= 1,
        atEnd: chapterOffset >= readableDistance - 1,
      })
    })
  }

  function attach(
    _section: unknown,
    view: { document?: Document; element?: HTMLElement },
  ) {
    const contentDocument = view.document
    if (!contentDocument || contentDocuments.has(contentDocument)) return
    contentDocuments.add(contentDocument)
    if (view.element) renderedViews.add(view.element)

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
    })
  }

  rendition.on('rendered', attach)
  return {
    update,
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
