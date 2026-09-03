import type { TocItem } from '../../../types/book'
import type { EpubBook, EpubRendition } from './epub-types'
import { flattenToc, isSameChapterHref } from './epub-navigation'

const CHAPTER_SPACER_ATTRIBUTE = 'data-lento-chapter-spacer'
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

interface RenderedContents {
  document?: Document
  sectionIndex?: number
}

interface TrackedContents {
  document: Document
  resourceHref: string
}

export interface MinimumChapterHeightController {
  update: () => void
  scheduleUpdate: () => void
  cleanup: () => void
}

function getFragment(href: string): string | undefined {
  const fragment = href.split('#')[1]
  if (!fragment) return undefined
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}

function findAnchor(document: Document, fragment: string): Element | undefined {
  return (
    document.getElementById(fragment) ??
    document.getElementsByName(fragment)[0]
  )
}

function getDocumentOffsetTop(element: Element): number {
  return (
    element.getBoundingClientRect().top +
    (element.ownerDocument.defaultView?.scrollY ?? 0)
  )
}

function getDocumentHeight(document: Document): number {
  return Math.max(
    document.body?.scrollHeight ?? 0,
    document.documentElement?.scrollHeight ?? 0,
  )
}

export function getMinimumChapterSpacerHeight(
  startOffset: number,
  endOffset: number,
  viewportHeight: number,
): number {
  return Math.max(0, Math.ceil(viewportHeight - (endOffset - startOffset)))
}

function createSpacer(document: Document, key: string): HTMLElement {
  const spacer = document.createElementNS(
    XHTML_NAMESPACE,
    'div',
  ) as HTMLElement
  spacer.setAttribute(CHAPTER_SPACER_ATTRIBUTE, key)
  spacer.setAttribute('aria-hidden', 'true')
  spacer.style.setProperty('display', 'block', 'important')
  spacer.style.setProperty('width', '100%', 'important')
  spacer.style.setProperty('height', '0', 'important')
  spacer.style.setProperty('margin', '0', 'important')
  spacer.style.setProperty('padding', '0', 'important')
  spacer.style.setProperty('border', '0', 'important')
  spacer.style.setProperty('font-size', '0', 'important')
  spacer.style.setProperty('line-height', '0', 'important')
  spacer.style.setProperty('pointer-events', 'none', 'important')
  return spacer
}

function applyMinimumChapterHeight(
  document: Document,
  toc: TocItem[],
  resourceHref: string,
  viewportHeight: number,
) {
  if (!document.body || viewportHeight <= 0) return

  const existingSpacers = new Map(
    [...document.querySelectorAll<HTMLElement>(`[${CHAPTER_SPACER_ATTRIBUTE}]`)]
      .map((spacer) => [
        spacer.getAttribute(CHAPTER_SPACER_ATTRIBUTE) ?? '',
        spacer,
      ]),
  )
  const usedSpacerKeys = new Set<string>()
  const seenAnchors = new Set<Element>()
  const anchors = flattenToc(toc).flatMap((item) => {
    if (!isSameChapterHref(resourceHref, item.href)) return []
    const fragment = getFragment(item.href)
    const anchor = fragment ? findAnchor(document, fragment) : document.body
    if (!anchor || seenAnchors.has(anchor)) return []
    seenAnchors.add(anchor)
    return [anchor]
  })

  function getSpacer(key: string): HTMLElement {
    const existing = existingSpacers.get(key)
    if (existing) return existing
    return createSpacer(document, key)
  }

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const currentAnchor = anchors[index]
    const nextAnchor = anchors[index + 1]
    const parent = nextAnchor.parentNode
    if (!parent) continue

    const key = `before-${index + 1}`
    const spacer = getSpacer(key)
    usedSpacerKeys.add(key)
    spacer.style.setProperty('height', '0', 'important')
    parent.insertBefore(spacer, nextAnchor)
    const spacerHeight = getMinimumChapterSpacerHeight(
      getDocumentOffsetTop(currentAnchor),
      getDocumentOffsetTop(nextAnchor),
      viewportHeight,
    )
    spacer.style.setProperty('height', `${spacerHeight}px`, 'important')
  }

  const lastAnchor = anchors.at(-1)
  if (lastAnchor) {
    const key = 'after-last'
    const spacer = getSpacer(key)
    usedSpacerKeys.add(key)
    spacer.style.setProperty('height', '0', 'important')
    document.body.append(spacer)
    const spacerHeight = getMinimumChapterSpacerHeight(
      getDocumentOffsetTop(lastAnchor),
      getDocumentHeight(document),
      viewportHeight,
    )
    spacer.style.setProperty('height', `${spacerHeight}px`, 'important')
  }

  for (const [key, spacer] of existingSpacers) {
    if (!usedSpacerKeys.has(key)) spacer.remove()
  }
}

export function attachMinimumChapterHeight(
  rendition: EpubRendition,
  book: EpubBook,
  viewerElement: HTMLElement,
  toc: TocItem[],
): MinimumChapterHeightController {
  const trackedContents = new Map<Document, TrackedContents>()
  let updateFrame: number | undefined

  function getViewportHeight() {
    return (
      viewerElement.querySelector<HTMLElement>('.epub-container')
        ?.clientHeight ?? viewerElement.clientHeight
    )
  }

  function apply(contents: RenderedContents) {
    const { document, sectionIndex } = contents
    if (!document || sectionIndex === undefined) return
    const resourceHref = book.spine.get(sectionIndex)?.href
    if (!resourceHref) return
    trackedContents.set(document, { document, resourceHref })
    applyMinimumChapterHeight(
      document,
      toc,
      resourceHref,
      getViewportHeight(),
    )
  }

  function update() {
    cancelAnimationFrame(updateFrame ?? 0)
    updateFrame = undefined
    const viewportHeight = getViewportHeight()
    for (const tracked of trackedContents.values()) {
      if (!tracked.document.defaultView) {
        trackedContents.delete(tracked.document)
        continue
      }
      applyMinimumChapterHeight(
        tracked.document,
        toc,
        tracked.resourceHref,
        viewportHeight,
      )
    }
  }

  function scheduleUpdate() {
    cancelAnimationFrame(updateFrame ?? 0)
    updateFrame = requestAnimationFrame(update)
  }

  rendition.hooks.content.register(apply)
  return {
    update,
    scheduleUpdate,
    cleanup: () => {
      rendition.hooks.content.deregister(apply)
      cancelAnimationFrame(updateFrame ?? 0)
      for (const { document } of trackedContents.values()) {
        document
          .querySelectorAll(`[${CHAPTER_SPACER_ATTRIBUTE}]`)
          .forEach((spacer) => spacer.remove())
      }
      trackedContents.clear()
    },
  }
}
