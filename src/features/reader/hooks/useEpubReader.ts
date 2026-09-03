import { useEffect, useRef, useState } from 'react'
import { getBookFile, updateBookReadingState } from '../../../data/indexed-db/book-repository'
import { getReadingAssets } from '../../../data/indexed-db/reading-asset-repository'
import type {
  BookRecord,
  ReadingAsset,
  ReadingHighlight,
  ReaderLocation,
  TocItem,
} from '../../../types/book'
import { attachReadingHighlightHover, renderReadingHighlight } from '../epub/epub-annotations'
import {
  findChapterAtDocumentOffset,
  locateChapterRange,
} from '../epub/epub-chapter-locator'
import {
  attachMinimumChapterHeight,
  type MinimumChapterHeightController,
} from '../epub/epub-chapter-spacing'
import { EpubReaderRuntime } from '../epub/EpubReaderRuntime'
import {
  attachContentScrollBridge,
  type ChapterScrollProgress,
  type ContentScrollBridgeController,
} from '../epub/epub-input-bridge'
import {
  getChapterIndex,
  getChapterProgress,
  isSameChapterResource,
  type EpubChapterIndex,
} from '../epub/epub-navigation'
import { registerReaderTheme } from '../epub/epub-theme'
import type { EpubRendition } from '../epub/epub-types'
import type { ReaderPreferenceController } from './useReaderPreferences'

export interface EpubTextSelection {
  cfi: string
  text: string
  contentWindow: Window
  href?: string
  chapterLabel?: string
}

interface UseEpubReaderOptions {
  bookRecord: BookRecord
  preferences: ReaderPreferenceController
  onBookUpdate: (book: BookRecord) => void
  onBookChanged: () => void
  onAssetsLoaded: (assets: ReadingAsset[]) => void
  onSearchSourceReady: (data: ArrayBuffer) => void
  onHighlightOpen: (highlight: ReadingHighlight) => void
  onTextSelected: (selection: EpubTextSelection) => void
  hasPendingSelection: () => boolean
  onDismissPendingSelection: () => void
  onContentPointerDown: () => void
  onSearchRequested: () => void
  onPageTurn: (direction: 'previous' | 'next') => void
}

const EMPTY_CHAPTER_SCROLL: ChapterScrollProgress = {
  progress: 0,
  atStart: false,
  atEnd: false,
  scrollSize: 0,
  viewportSize: 0,
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (
    !target ||
    typeof (target as { closest?: unknown }).closest !== 'function'
  ) {
    return false
  }
  const element = target as Element
  if (element.closest('.page-turn-zone')) return false
  return Boolean(
    element.closest(
      'input, textarea, select, button, [contenteditable="true"]',
    ),
  )
}

export function useEpubReader(options: UseEpubReaderOptions) {
  const { bookRecord, preferences } = options
  const callbacksRef = useRef(options)
  callbacksRef.current = options
  const preferencesRef = useRef(preferences)
  preferencesRef.current = preferences
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const scrollBridgeRef = useRef<ContentScrollBridgeController | null>(null)
  const minimumChapterHeightRef =
    useRef<MinimumChapterHeightController | null>(null)
  const currentLocationRef = useRef(bookRecord.location)
  const currentBookIdRef = useRef(bookRecord.id)
  const chapterIndexRef = useRef<EpubChapterIndex | undefined>(undefined)
  const currentChapterHrefRef = useRef<string | undefined>(undefined)
  const currentChapterLabelRef = useRef(bookRecord.chapterLabel)
  const [toc, setToc] = useState<TocItem[]>([])
  const [currentHref, setCurrentHref] = useState<string>()
  const [chapterLabel, setChapterLabel] = useState(bookRecord.chapterLabel)
  const [chapterScroll, setChapterScroll] =
    useState<ChapterScrollProgress>(EMPTY_CHAPTER_SCROLL)
  const {
    progress: chapterProgress,
    atStart: atChapterStart,
    atEnd: atChapterEnd,
    scrollSize: chapterScrollSize,
    viewportSize: chapterViewportSize,
  } = chapterScroll
  const [isOpening, setIsOpening] = useState(true)
  const [openingMessage, setOpeningMessage] = useState('正在读取书籍…')
  const [error, setError] = useState<string>()

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (
        event.key.toLocaleLowerCase() !== 'f' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      callbacksRef.current.onSearchRequested()
    }

    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (currentBookIdRef.current !== bookRecord.id) {
      callbacksRef.current.onBookChanged()
      currentBookIdRef.current = bookRecord.id
      currentLocationRef.current = bookRecord.location
      chapterIndexRef.current = undefined
      currentChapterHrefRef.current = undefined
      currentChapterLabelRef.current = bookRecord.chapterLabel
      setToc([])
      setCurrentHref(undefined)
      setChapterLabel(bookRecord.chapterLabel)
      setChapterScroll(EMPTY_CHAPTER_SCROLL)
    }
    setError(undefined)
    setIsOpening(true)
    setOpeningMessage('正在读取书籍…')

    let isCancelled = false
    let locationsReady = false
    let runtime: EpubReaderRuntime | undefined
    let removeContentScrollBridge: (() => void) | undefined
    let removeContentDocumentEvents: (() => void) | undefined
    let removeRelocationListener: (() => void) | undefined
    let removeSelectionListener: (() => void) | undefined
    let removeMinimumChapterHeight: (() => void) | undefined
    let updateScrolledChapterProgress: (() => void) | undefined
    let persistTimer: ReturnType<typeof setTimeout> | undefined
    let pendingReadingState:
      | Pick<BookRecord, 'progress' | 'location' | 'chapterLabel'>
      | undefined

    function persistReadingState() {
      const readingState = pendingReadingState
      pendingReadingState = undefined
      if (!readingState) return
      void updateBookReadingState(bookRecord.id, readingState).then(
        (updatedBook) => {
          if (updatedBook) callbacksRef.current.onBookUpdate(updatedBook)
        },
      )
    }

    async function openBook(viewerElement: HTMLDivElement) {
      try {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        if (isCancelled) return

        const [data, storedReadingAssets] = await Promise.all([
          getBookFile(bookRecord.id),
          getReadingAssets(bookRecord.id),
        ])
        if (!data) throw new Error('找不到原始 EPUB 文件。')
        if (isCancelled) return
        callbacksRef.current.onAssetsLoaded(storedReadingAssets)
        callbacksRef.current.onSearchSourceReady(data)
        setOpeningMessage('正在排版正文…')

        runtime = await EpubReaderRuntime.create({
          data,
          viewer: viewerElement,
          flow: preferencesRef.current.flow,
          theme: {
            theme: preferencesRef.current.theme,
            font: preferencesRef.current.font,
            fontSize: preferencesRef.current.fontSize,
            flow: preferencesRef.current.flow,
            lineHeight: preferencesRef.current.lineHeight,
            readerWidth: preferencesRef.current.readerWidth,
            paragraphStyle: preferencesRef.current.paragraphStyle,
          },
          isCancelled: () => isCancelled,
        })
        if (!runtime || isCancelled) return
        const { book, rendition } = runtime
        renditionRef.current = rendition

        for (const asset of storedReadingAssets) {
          if (asset.kind === 'highlight') {
            renderReadingHighlight(
              rendition,
              asset,
              (highlight) => callbacksRef.current.onHighlightOpen(highlight),
            )
          }
        }

        function handleTextSelected(
          cfi: string,
          contents: { window?: Window },
        ) {
          const contentWindow = contents.window
          const selection = contentWindow?.getSelection()
          const text = selection?.toString().replace(/\s+/g, ' ').trim()
          if (!text || !contentWindow) return
          callbacksRef.current.onTextSelected({
            cfi,
            text,
            contentWindow,
            href: currentChapterHrefRef.current,
            chapterLabel: currentChapterLabelRef.current,
          })
        }
        rendition.on('selected', handleTextSelected)
        removeSelectionListener = () => rendition.off('selected', handleTextSelected)

        const contentDocuments = new Set<Document>()
        const renderedContentViews = new Map<Document, HTMLElement>()
        const highlightHoverCleanups = new Map<Document, () => void>()
        const handleContentPointerDown = () => {
          callbacksRef.current.onContentPointerDown()
        }
        function handlePaginationKeyDown(event: KeyboardEvent) {
          if (
            event.key === 'Escape' &&
            callbacksRef.current.hasPendingSelection()
          ) {
            event.preventDefault()
            callbacksRef.current.onDismissPendingSelection()
            return
          }
          if (
            event.key.toLocaleLowerCase() === 'f' &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey
          ) {
            event.preventDefault()
            callbacksRef.current.onSearchRequested()
            return
          }
          if (
            preferencesRef.current.flow !== 'paginated' ||
            !preferencesRef.current.keyboardPagination ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            isEditableKeyboardTarget(event.target)
          ) {
            return
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            callbacksRef.current.onPageTurn('previous')
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            callbacksRef.current.onPageTurn('next')
          }
        }

        function attachContentDocumentEvents(
          _section: unknown,
          view: { document?: Document; element?: HTMLElement },
        ) {
          const contentDocument = view.document
          if (!contentDocument || contentDocuments.has(contentDocument)) return
          contentDocuments.add(contentDocument)
          if (view.element) {
            renderedContentViews.set(contentDocument, view.element)
          }
          highlightHoverCleanups.set(
            contentDocument,
            attachReadingHighlightHover(contentDocument),
          )
          contentDocument.addEventListener(
            'pointerdown',
            handleContentPointerDown,
          )
          contentDocument.addEventListener('keydown', handlePaginationKeyDown)
        }
        rendition.on('rendered', attachContentDocumentEvents)
        removeContentDocumentEvents = () => {
          rendition.off('rendered', attachContentDocumentEvents)
          for (const contentDocument of contentDocuments) {
            highlightHoverCleanups.get(contentDocument)?.()
            contentDocument.removeEventListener(
              'pointerdown',
              handleContentPointerDown,
            )
            contentDocument.removeEventListener(
              'keydown',
              handlePaginationKeyDown,
            )
          }
          highlightHoverCleanups.clear()
          contentDocuments.clear()
          renderedContentViews.clear()
        }

        if (preferencesRef.current.flow !== 'paginated') {
          const scrollBridge = attachContentScrollBridge(
            rendition,
            viewerElement,
            setChapterScroll,
            preferencesRef.current.flow === 'chapter'
              ? {
                  getChapterRange: ({ document, element }) => {
                    const chapterHref = currentChapterHrefRef.current
                    const chapterIndex = chapterIndexRef.current
                    if (!chapterHref || !chapterIndex) return undefined
                    const range = locateChapterRange(
                      document,
                      chapterIndex,
                      chapterHref,
                      element.offsetHeight,
                    )
                    if (!range) return undefined

                    return {
                      start: element.offsetTop + range.start,
                      end: element.offsetTop + range.end,
                    }
                  },
                }
              : undefined,
          )
          scrollBridgeRef.current = scrollBridge
          updateScrolledChapterProgress = scrollBridge.update
          removeContentScrollBridge = scrollBridge.cleanup
        }

        const navigation = await book.loaded.navigation
        if (isCancelled) return
        const navigationItems = navigation.toc as TocItem[]
        const chapterIndex = getChapterIndex(navigationItems)
        chapterIndexRef.current = chapterIndex
        setToc(navigationItems)
        if (preferencesRef.current.flow !== 'paginated') {
          const minimumChapterHeight = attachMinimumChapterHeight(
            rendition,
            book,
            viewerElement,
            chapterIndex,
          )
          minimumChapterHeightRef.current = minimumChapterHeight
          removeMinimumChapterHeight = minimumChapterHeight.cleanup
        }

        function handleRelocated(location: ReaderLocation) {
          const nextProgress = locationsReady
            ? Math.max(
                0,
                Math.min(
                  1,
                  book.locations.percentageFromCfi(location.start.cfi),
                ),
              )
            : bookRecord.progress
          const currentChapterHref = currentChapterHrefRef.current
          const staysInCurrentResource = Boolean(
            currentChapterHref &&
              isSameChapterResource(currentChapterHref, location.start.href),
          )
          const renderedChapter = !currentChapterHref
            ? (() => {
                const chapterIndex = chapterIndexRef.current
                const container = viewerElement.querySelector<HTMLElement>(
                  '.epub-container',
                )
                const renderedView = [...renderedContentViews.entries()].find(
                  ([, element]) =>
                    element.isConnected &&
                    container &&
                    container.scrollTop <
                      element.offsetTop + element.offsetHeight,
                )
                if (!chapterIndex || !container || !renderedView) {
                  return undefined
                }
                const [contentDocument, viewElement] = renderedView
                return findChapterAtDocumentOffset(
                  contentDocument,
                  chapterIndex,
                  location.start.href,
                  container.scrollTop - viewElement.offsetTop,
                )?.item
              })()
            : undefined
          const nextChapter =
            renderedChapter ??
            chapterIndexRef.current?.find(
              staysInCurrentResource && currentChapterHref
                ? currentChapterHref
                : location.start.href,
              staysInCurrentResource
                ? currentChapterLabelRef.current
                : currentChapterHref
                  ? undefined
                  : bookRecord.chapterLabel,
            )?.item
          const nextChapterHref = nextChapter?.href ?? location.start.href
          const nextChapterLabel = nextChapter?.label.trim()
          currentChapterHrefRef.current = nextChapterHref
          currentChapterLabelRef.current = nextChapterLabel
          setCurrentHref(nextChapterHref)
          if (preferencesRef.current.flow === 'paginated') {
            const nextChapterProgress = getChapterProgress(location)
            setChapterScroll({
              progress: nextChapterProgress,
              atStart: nextChapterProgress <= 0,
              atEnd: nextChapterProgress >= 1,
              scrollSize: 0,
              viewportSize: 0,
            })
          } else {
            updateScrolledChapterProgress?.()
          }
          setChapterLabel(nextChapterLabel)
          currentLocationRef.current = location.start.cfi
          pendingReadingState = {
            location: location.start.cfi,
            progress: nextProgress,
            chapterLabel: nextChapterLabel,
          }
          clearTimeout(persistTimer)
          persistTimer = setTimeout(persistReadingState, 350)
        }
        rendition.on('relocated', handleRelocated)
        removeRelocationListener = () => rendition.off('relocated', handleRelocated)

        await rendition.display(currentLocationRef.current)
        if (isCancelled) return
        setIsOpening(false)

        try {
          await book.locations.generate(1200)
          if (isCancelled) return
          locationsReady = true
          const currentLocation = currentLocationRef.current
          if (currentLocation) {
            pendingReadingState = {
              location: currentLocation,
              progress: Math.max(
                0,
                Math.min(1, book.locations.percentageFromCfi(currentLocation)),
              ),
              chapterLabel: currentChapterLabelRef.current,
            }
            clearTimeout(persistTimer)
            persistTimer = setTimeout(persistReadingState, 350)
          }
        } catch {
          // The book remains readable if whole-book progress indexing fails.
        }
      } catch (readerError) {
        if (!isCancelled) {
          setIsOpening(false)
          setError(
            readerError instanceof Error
              ? readerError.message
              : '这本书暂时无法打开。',
          )
        }
      }
    }

    void openBook(viewer)
    return () => {
      isCancelled = true
      clearTimeout(persistTimer)
      persistReadingState()
      removeContentScrollBridge?.()
      removeContentDocumentEvents?.()
      removeRelocationListener?.()
      removeSelectionListener?.()
      removeMinimumChapterHeight?.()
      if (
        minimumChapterHeightRef.current?.cleanup === removeMinimumChapterHeight
      ) {
        minimumChapterHeightRef.current = null
      }
      if (scrollBridgeRef.current?.cleanup === removeContentScrollBridge) {
        scrollBridgeRef.current = null
      }
      runtime?.destroy()
      if (renditionRef.current === runtime?.rendition) renditionRef.current = null
      viewer.replaceChildren()
    }
  }, [bookRecord.id, preferences.flow])

  useEffect(() => {
    const rendition = renditionRef.current
    let updateFrame: number | undefined
    if (rendition) {
      registerReaderTheme(rendition, {
        theme: preferences.theme,
        font: preferences.font,
        fontSize: preferences.fontSize,
        flow: preferences.flow,
        lineHeight: preferences.lineHeight,
        readerWidth: preferences.readerWidth,
        paragraphStyle: preferences.paragraphStyle,
      })
      updateFrame = requestAnimationFrame(() => {
        minimumChapterHeightRef.current?.scheduleUpdate()
      })
    }
    return () => cancelAnimationFrame(updateFrame ?? 0)
  }, [
    preferences.font,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.paragraphStyle,
    preferences.flow,
    preferences.readerWidth,
    preferences.theme,
  ])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const viewer = viewerRef.current
    if (!viewer) return

    let resizeFrame: number | undefined
    let previousWidth = viewer.clientWidth
    let previousHeight = viewer.clientHeight
    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)
      if (
        width <= 0 ||
        height <= 0 ||
        (width === previousWidth && height === previousHeight)
      ) {
        return
      }
      previousWidth = width
      previousHeight = height
      cancelAnimationFrame(resizeFrame ?? 0)
      resizeFrame = requestAnimationFrame(() => {
        renditionRef.current?.resize(width, height)
        minimumChapterHeightRef.current?.scheduleUpdate()
      })
    })
    resizeObserver.observe(viewer)
    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(resizeFrame ?? 0)
    }
  }, [bookRecord.id, preferences.flow])

  useEffect(() => {
    if (preferences.flow !== 'paginated') return
    function handlePaginationKeyDown(event: KeyboardEvent) {
      if (
        !preferencesRef.current.keyboardPagination ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableKeyboardTarget(event.target)
      ) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        callbacksRef.current.onPageTurn('previous')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        callbacksRef.current.onPageTurn('next')
      }
    }
    document.addEventListener('keydown', handlePaginationKeyDown)
    return () => document.removeEventListener('keydown', handlePaginationKeyDown)
  }, [preferences.flow])

  function resetChapterBoundary() {
    setChapterScroll(EMPTY_CHAPTER_SCROLL)
  }

  function scrollChapterToProgress(progress: number) {
    scrollBridgeRef.current?.scrollToProgress(progress)
  }

  function displayChapter(href: string) {
    const chapter = chapterIndexRef.current?.find(href)
    const nextHref = chapter?.item.href ?? href
    const nextLabel = chapter?.item.label.trim()
    currentChapterHrefRef.current = nextHref
    currentChapterLabelRef.current = nextLabel
    setCurrentHref(nextHref)
    setChapterLabel(nextLabel)
    resetChapterBoundary()
    const display = renditionRef.current?.display(href)
    void display?.then(() => {
      requestAnimationFrame(() => {
        if (!chapter) return
        scrollBridgeRef.current?.scrollToChapter(chapter)
        requestAnimationFrame(() => {
          scrollBridgeRef.current?.scrollToChapter(chapter)
        })
      })
    })
  }

  return {
    viewerRef,
    renditionRef,
    currentLocationRef,
    toc,
    currentHref,
    chapterLabel,
    chapterProgress,
    chapterScrollSize,
    chapterViewportSize,
    atChapterStart,
    atChapterEnd,
    isOpening,
    openingMessage,
    error,
    resetChapterBoundary,
    displayChapter,
    scrollChapterToProgress,
  }
}
