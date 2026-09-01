import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ePub from 'epubjs'
import {
  ChevronLeft,
  ChevronRight,
  List,
  PanelLeftOpen,
  Search,
  Settings,
} from 'lucide-react'
import { getBookFile, updateBookReadingState } from '../../lib/book-storage'
import { sanitizeEpubFontSources } from '../../lib/epub-font-sanitizer'
import {
  DEFAULT_READER_FONT,
  getReaderFontFamily,
  parseStoredReaderFont,
  type ReaderFont,
} from '../../lib/reader-font'
import {
  ReaderSettings,
  type ReaderFlow,
  type ReaderLineHeight,
  type ReaderParagraphStyle,
  type ReaderTheme,
  type ReaderWidth,
} from './ReaderSettings'
import {
  BookSearchPanel,
  type BookSearchResult,
} from './BookSearchPanel'
import { TocPanel } from './TocPanel'
import type {
  BookRecord,
  ReaderLocation,
  TocItem,
} from '../../types/book'

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>
type EpubSection = ReturnType<EpubBook['spine']['get']>
type NavigationPanel = 'toc' | 'search'

interface ReaderPageProps {
  bookRecord: BookRecord
  onBack: () => void
  onBookUpdate: (book: BookRecord) => void
}

const THEME_COLORS: Record<
  ReaderTheme,
  { background: string; color: string }
> = {
  paper: { background: '#f5f2eb', color: '#1e2925' },
  light: { background: '#ffffff', color: '#18201d' },
  night: { background: '#202421', color: '#e6e1d5' },
}

const READER_FLOW_STORAGE_KEY = 'lento:reader-flow:v2'
const LEGACY_READER_FLOW_STORAGE_KEY = 'lento:reader-flow:v1'
const READER_FONT_STORAGE_KEY = 'lento:reader-font:v2'
const LEGACY_READER_FONT_STORAGE_KEY = 'lento:reader-font:v1'
const READER_FONT_SIZE_STORAGE_KEY = 'lento:reader-font-size:v1'
const READER_THEME_STORAGE_KEY = 'lento:reader-theme:v1'
const READER_LINE_HEIGHT_STORAGE_KEY = 'lento:reader-line-height:v1'
const READER_WIDTH_STORAGE_KEY = 'lento:reader-width:v1'
const READER_PARAGRAPH_STYLE_STORAGE_KEY = 'lento:reader-paragraph-style:v1'
const KEYBOARD_PAGINATION_STORAGE_KEY = 'lento:keyboard-pagination:v1'
const CLICK_PAGINATION_STORAGE_KEY = 'lento:click-pagination:v1'
const DEFAULT_READER_FONT_SIZE = 18
const MIN_READER_FONT_SIZE = 15
const MAX_READER_FONT_SIZE = 26

const READER_LINE_HEIGHTS: Record<ReaderLineHeight, number> = {
  compact: 1.72,
  standard: 2.05,
  relaxed: 2.4,
}

const READER_WIDTHS: Record<ReaderWidth, number> = {
  narrow: 620,
  standard: 760,
  wide: 940,
}

const PAGINATED_HORIZONTAL_PADDING: Record<ReaderWidth, string> = {
  narrow: 'clamp(34px, 9vw, 76px)',
  standard: 'clamp(22px, 5vw, 46px)',
  wide: 'clamp(14px, 3vw, 28px)',
}

function getInitialReaderFont(): ReaderFont {
  try {
    return parseStoredReaderFont(
      localStorage.getItem(READER_FONT_STORAGE_KEY),
      localStorage.getItem(LEGACY_READER_FONT_STORAGE_KEY),
    )
  } catch {
    // Fall back to the current reader default when local storage is unavailable.
  }

  return DEFAULT_READER_FONT
}

function getInitialReaderFontSize(): number {
  try {
    const savedFontSize = Number(
      localStorage.getItem(READER_FONT_SIZE_STORAGE_KEY),
    )
    if (
      Number.isInteger(savedFontSize) &&
      savedFontSize >= MIN_READER_FONT_SIZE &&
      savedFontSize <= MAX_READER_FONT_SIZE
    ) {
      return savedFontSize
    }
  } catch {
    // Fall back to the default when local storage is unavailable.
  }

  return DEFAULT_READER_FONT_SIZE
}

function getInitialReaderFlow(): ReaderFlow {
  try {
    const savedFlow = localStorage.getItem(READER_FLOW_STORAGE_KEY)
    if (
      savedFlow === 'chapter' ||
      savedFlow === 'continuous' ||
      savedFlow === 'paginated'
    ) {
      return savedFlow
    }

    return localStorage.getItem(LEGACY_READER_FLOW_STORAGE_KEY) === 'paginated'
      ? 'paginated'
      : 'chapter'
  } catch {
    return 'chapter'
  }
}

function getInitialReaderTheme(): ReaderTheme {
  try {
    const savedTheme = localStorage.getItem(READER_THEME_STORAGE_KEY)
    if (
      savedTheme === 'paper' ||
      savedTheme === 'light' ||
      savedTheme === 'night'
    ) {
      return savedTheme
    }
  } catch {
    // Fall back to the default when local storage is unavailable.
  }

  return 'light'
}

function getInitialReaderLineHeight(): ReaderLineHeight {
  try {
    const savedLineHeight = localStorage.getItem(
      READER_LINE_HEIGHT_STORAGE_KEY,
    )
    if (
      savedLineHeight === 'compact' ||
      savedLineHeight === 'standard' ||
      savedLineHeight === 'relaxed'
    ) {
      return savedLineHeight
    }
  } catch {
    // Fall back to the current reader line height.
  }

  return 'standard'
}

function getInitialReaderWidth(): ReaderWidth {
  try {
    const savedReaderWidth = localStorage.getItem(READER_WIDTH_STORAGE_KEY)
    if (
      savedReaderWidth === 'narrow' ||
      savedReaderWidth === 'standard' ||
      savedReaderWidth === 'wide'
    ) {
      return savedReaderWidth
    }
  } catch {
    // Fall back to the current reader width.
  }

  return 'standard'
}

function getInitialParagraphStyle(): ReaderParagraphStyle {
  try {
    const savedParagraphStyle = localStorage.getItem(
      READER_PARAGRAPH_STYLE_STORAGE_KEY,
    )
    if (
      savedParagraphStyle === 'publisher' ||
      savedParagraphStyle === 'indent' ||
      savedParagraphStyle === 'spaced'
    ) {
      return savedParagraphStyle
    }
  } catch {
    // Fall back to publisher paragraph formatting.
  }

  return 'publisher'
}

function getInitialBooleanPreference(key: string, defaultValue: boolean) {
  try {
    const storedValue = localStorage.getItem(key)
    if (storedValue === 'true') return true
    if (storedValue === 'false') return false
  } catch {
    // Fall back to the provided default when local storage is unavailable.
  }

  return defaultValue
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

function findChapterLabel(
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

function stripChapterFragment(href: string): string {
  return href.split('#')[0]
}

function isSameChapterHref(currentHref: string, tocHref: string): boolean {
  const currentPath = stripChapterFragment(currentHref)
  const tocPath = stripChapterFragment(tocHref)
  return (
    currentPath === tocPath ||
    currentPath.endsWith(tocPath) ||
    tocPath.endsWith(currentPath)
  )
}

function flattenToc(items: TocItem[]): TocItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.subitems ? flattenToc(item.subitems) : []),
  ])
}

function findChapterNeighbors(
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

function findSectionMatches(
  section: EpubSection,
  query: string,
): Array<{ cfi: string; excerpt: string }> {
  const root =
    section.document.querySelector('body') ?? section.document.documentElement
  const walker = section.document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const normalizedQuery = query.toLocaleLowerCase()
  const matches: Array<{ cfi: string; excerpt: string }> = []
  let node = walker.nextNode()

  while (node) {
    const parent = node.parentElement
    const text = node.textContent ?? ''
    if (
      text.trim() &&
      !parent?.closest('script, style, noscript, svg, [aria-hidden="true"]')
    ) {
      const normalizedText = text.toLocaleLowerCase()
      let matchIndex = normalizedText.indexOf(normalizedQuery)
      while (matchIndex >= 0) {
        const range = section.document.createRange()
        range.setStart(node, matchIndex)
        range.setEnd(node, matchIndex + query.length)
        const excerptStart = Math.max(0, matchIndex - 70)
        const excerptEnd = Math.min(
          text.length,
          matchIndex + query.length + 70,
        )
        matches.push({
          cfi: section.cfiFromRange(range),
          excerpt: `${excerptStart > 0 ? '…' : ''}${text.slice(
            excerptStart,
            excerptEnd,
          )}${excerptEnd < text.length ? '…' : ''}`,
        })
        matchIndex = normalizedText.indexOf(
          normalizedQuery,
          matchIndex + query.length,
        )
      }
    }
    node = walker.nextNode()
  }

  return matches
}

function getChapterProgress(location: ReaderLocation): number {
  const displayed = location.start.displayed
  if (!displayed || displayed.total <= 0) return 0
  if (displayed.total === 1) return 1

  const page = Math.max(1, Math.min(displayed.total, displayed.page))
  return (page - 1) / (displayed.total - 1)
}

function registerReaderTheme(
  rendition: EpubRendition,
  theme: ReaderTheme,
  font: ReaderFont,
  fontSize: number,
  flow: ReaderFlow,
  lineHeight: ReaderLineHeight,
  readerWidth: ReaderWidth,
  paragraphStyle: ReaderParagraphStyle,
) {
  const colors = THEME_COLORS[theme]
  const fontFamily = getReaderFontFamily(font)
  const lineHeightValue = READER_LINE_HEIGHTS[lineHeight]
  const paragraphRules =
    paragraphStyle === 'indent'
      ? {
          'text-indent': '2em !important',
          'margin-block': '0.35em !important',
        }
      : paragraphStyle === 'spaced'
        ? {
            'text-indent': '0 !important',
            'margin-block': '0 1em !important',
          }
        : {}

  // EPUB.js appends rules when a named theme is updated. Recreate its style
  // node so selecting “原书” can genuinely remove a previous font override.
  const contents = rendition.getContents() as unknown as Array<{
    document?: Document
  }>
  contents.forEach((content) => {
    content.document
      ?.getElementById('epubjs-inserted-css-lento')
      ?.remove()
  })

  rendition.themes.register('lento', {
    body: {
      color: `${colors.color} !important`,
      background: `${colors.background} !important`,
      'line-height': `${lineHeightValue} !important`,
      padding:
        flow === 'paginated'
          ? `0 ${PAGINATED_HORIZONTAL_PADDING[readerWidth]} !important`
          : '0 min(4vw, 30px) !important',
      ...(flow !== 'paginated'
        ? {
            width: `min(${READER_WIDTHS[readerWidth]}px, calc(100% - 8px)) !important`,
            margin: '0 auto !important',
            'box-sizing': 'border-box !important',
          }
        : {}),
    },
    ...(fontFamily
      ? {
          'body, p, div, span, li, td, th, blockquote, h1, h2, h3, h4, h5, h6': {
            'font-family': `${fontFamily} !important`,
          },
        }
      : {}),
    p: {
      'font-size': `${fontSize}px !important`,
      'line-height': `${lineHeightValue} !important`,
      ...paragraphRules,
    },
    h1: {
      'font-size': `${Math.round(fontSize * 1.75)}px !important`,
      'font-weight': '500 !important',
      'line-height': '1.45 !important',
    },
    h2: {
      'font-size': `${Math.round(fontSize * 1.4)}px !important`,
      'font-weight': '500 !important',
      'line-height': '1.5 !important',
    },
    a: { color: '#315d4b !important' },
    img: { 'max-width': '100% !important' },
  })
  rendition.themes.select('lento')
}

export function ReaderPage({
  bookRecord,
  onBack,
  onBookUpdate,
}: ReaderPageProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const searchSourceRef = useRef<
    { bookId: string; data: ArrayBuffer } | undefined
  >(undefined)
  const searchBookRef = useRef<
    { bookId: string; book: EpubBook } | undefined
  >(undefined)
  const keyboardPaginationRef = useRef(true)
  const paginationNavigationRef = useRef<
    (direction: 'previous' | 'next') => void
  >(() => undefined)
  const tocRef = useRef<TocItem[]>([])
  const currentLocationRef = useRef(bookRecord.location)
  const currentBookIdRef = useRef(bookRecord.id)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 980)
  const [navigationPanel, setNavigationPanel] =
    useState<NavigationPanel>('toc')
  const [currentHref, setCurrentHref] = useState<string>()
  const [chapterLabel, setChapterLabel] = useState(bookRecord.chapterLabel)
  const [chapterProgress, setChapterProgress] = useState(0)
  const [atChapterStart, setAtChapterStart] = useState(false)
  const [atChapterEnd, setAtChapterEnd] = useState(false)
  const [font, setFont] = useState<ReaderFont>(getInitialReaderFont)
  const [fontSize, setFontSize] = useState(getInitialReaderFontSize)
  const [readerFlow, setReaderFlow] = useState<ReaderFlow>(getInitialReaderFlow)
  const [lineHeight, setLineHeight] = useState<ReaderLineHeight>(
    getInitialReaderLineHeight,
  )
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>(
    getInitialReaderWidth,
  )
  const [paragraphStyle, setParagraphStyle] =
    useState<ReaderParagraphStyle>(getInitialParagraphStyle)
  const [keyboardPagination, setKeyboardPagination] = useState(() =>
    getInitialBooleanPreference(KEYBOARD_PAGINATION_STORAGE_KEY, true),
  )
  const [clickPagination, setClickPagination] = useState(() =>
    getInitialBooleanPreference(CLICK_PAGINATION_STORAGE_KEY, false),
  )
  const [theme, setTheme] = useState<ReaderTheme>(getInitialReaderTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(true)
  const [openingMessage, setOpeningMessage] = useState('正在读取书籍…')
  const [error, setError] = useState<string>()

  keyboardPaginationRef.current = keyboardPagination

  useEffect(() => {
    return () => {
      if (searchBookRef.current?.bookId === bookRecord.id) {
        searchBookRef.current.book.destroy()
        searchBookRef.current = undefined
      }
      if (searchSourceRef.current?.bookId === bookRecord.id) {
        searchSourceRef.current = undefined
      }
    }
  }, [bookRecord.id])

  useEffect(() => {
    if (!settingsOpen) return

    function closeSettingsOutside(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        settingsAnchorRef.current?.contains(target)
      ) {
        return
      }
      setSettingsOpen(false)
    }

    document.addEventListener('pointerdown', closeSettingsOutside)
    return () => {
      document.removeEventListener('pointerdown', closeSettingsOutside)
    }
  }, [settingsOpen])

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
      setSettingsOpen(false)
      setNavigationPanel('search')
      setTocOpen(true)
    }

    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (currentBookIdRef.current !== bookRecord.id) {
      currentBookIdRef.current = bookRecord.id
      currentLocationRef.current = bookRecord.location
      setChapterProgress(0)
      setAtChapterStart(false)
      setAtChapterEnd(false)
    }
    setError(undefined)
    setIsOpening(true)
    setOpeningMessage('正在读取书籍…')

    let isCancelled = false
    let locationsReady = false
    let effectBook: EpubBook | null = null
    let effectRendition: EpubRendition | null = null
    let releaseSanitizedFontStyles: (() => void) | undefined
    let removeContentScrollBridge: (() => void) | undefined
    let removeContentSettingsDismissal: (() => void) | undefined
    let removeRelocationListener: (() => void) | undefined
    let updateScrolledChapterProgress: (() => void) | undefined
    let currentChapterLabel = bookRecord.chapterLabel
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
          if (updatedBook) onBookUpdate(updatedBook)
        },
      )
    }

    async function openBook(viewerElement: HTMLDivElement) {
      try {
        // Let React's development-only StrictMode cleanup cancel the first run
        // before EPUB.js starts its asynchronous rendition lifecycle.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (isCancelled) return

        const data = await getBookFile(bookRecord.id)
        if (!data) throw new Error('找不到原始 EPUB 文件。')
        if (isCancelled) return
        searchSourceRef.current = { bookId: bookRecord.id, data }
        setOpeningMessage('正在排版正文…')

        const epubBook = ePub(data.slice(0))
        effectBook = epubBook
        const releaseFontStyles = await sanitizeEpubFontSources(
          epubBook as unknown as Parameters<typeof sanitizeEpubFontSources>[0],
        )
        if (isCancelled) {
          releaseFontStyles()
          return
        }
        releaseSanitizedFontStyles = releaseFontStyles

        const rendition = epubBook.renderTo(viewerElement, {
          width: '100%',
          height: '100%',
          manager: readerFlow === 'continuous' ? 'continuous' : 'default',
          flow: readerFlow === 'paginated' ? 'paginated' : 'scrolled',
          spread: 'none',
        })
        effectRendition = rendition
        renditionRef.current = rendition
        registerReaderTheme(
          rendition,
          theme,
          font,
          fontSize,
          readerFlow,
          lineHeight,
          readerWidth,
          paragraphStyle,
        )

        const settingsDocuments = new Set<Document>()
        function handlePaginationKeyDown(event: KeyboardEvent) {
          if (
            event.key.toLocaleLowerCase() === 'f' &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey
          ) {
            event.preventDefault()
            setSettingsOpen(false)
            setNavigationPanel('search')
            setTocOpen(true)
            return
          }
          if (
            readerFlow !== 'paginated' ||
            !keyboardPaginationRef.current ||
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
            paginationNavigationRef.current('previous')
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            paginationNavigationRef.current('next')
          }
        }

        function attachSettingsDismissal(
          _section: unknown,
          view: { document?: Document },
        ) {
          const contentDocument = view.document
          if (!contentDocument || settingsDocuments.has(contentDocument)) return
          settingsDocuments.add(contentDocument)
          contentDocument.addEventListener('pointerdown', closeReaderSettings)
          contentDocument.addEventListener('keydown', handlePaginationKeyDown)
        }
        function closeReaderSettings() {
          setSettingsOpen(false)
        }
        rendition.on('rendered', attachSettingsDismissal)
        removeContentSettingsDismissal = () => {
          rendition.off('rendered', attachSettingsDismissal)
          settingsDocuments.forEach((contentDocument) => {
            contentDocument.removeEventListener(
              'pointerdown',
              closeReaderSettings,
            )
            contentDocument.removeEventListener(
              'keydown',
              handlePaginationKeyDown,
            )
          })
          settingsDocuments.clear()
        }

        if (readerFlow !== 'paginated') {
          const contentDocuments = new Set<Document>()
          const renderedViews = new Set<HTMLElement>()
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

          function scheduleChapterProgressUpdate() {
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
                setAtChapterStart(false)
                setAtChapterEnd(false)
                return
              }

              const readableDistance = Math.max(
                0,
                activeView.offsetHeight - container.clientHeight,
              )
              if (readableDistance === 0) {
                setChapterProgress(1)
                setAtChapterStart(true)
                setAtChapterEnd(true)
                return
              }

              const chapterOffset = Math.max(
                0,
                Math.min(
                  readableDistance,
                  container.scrollTop - activeView.offsetTop,
                ),
              )
              const nextChapterProgress = chapterOffset / readableDistance
              setChapterProgress(nextChapterProgress)
              setAtChapterStart(chapterOffset <= 1)
              setAtChapterEnd(chapterOffset >= readableDistance - 1)
            })
          }

          updateScrolledChapterProgress = scheduleChapterProgressUpdate

          function attachContentScrollBridge(
            _section: unknown,
            view: { document?: Document; element?: HTMLElement },
          ) {
            const document = view.document
            if (!document || contentDocuments.has(document)) return
            contentDocuments.add(document)
            if (view.element) renderedViews.add(view.element)

            const container = getScrollContainer()
            if (container && container !== scrollContainer) {
              scrollContainer?.removeEventListener(
                'scroll',
                scheduleChapterProgressUpdate,
              )
              scrollContainer = container
              scrollContainer.addEventListener(
                'scroll',
                scheduleChapterProgressUpdate,
                { passive: true },
              )
            }
            scheduleChapterProgressUpdate()

            document.addEventListener(
              'wheel',
              (event) => {
                if (event.ctrlKey) return
                const container = getScrollContainer()
                if (!container) return
                const scale =
                  event.deltaMode === WheelEvent.DOM_DELTA_LINE
                    ? 18
                    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                      ? container.clientHeight
                      : 1
                scrollBy(event.deltaY * scale, event)
              },
              { passive: false },
            )
            document.addEventListener(
              'touchstart',
              (event) => {
                if (event.touches.length === 1) {
                  lastTouchY = event.touches[0].clientY
                }
              },
              { passive: true },
            )
            document.addEventListener(
              'touchmove',
              (event) => {
                if (event.touches.length !== 1 || lastTouchY === undefined) {
                  return
                }
                const nextTouchY = event.touches[0].clientY
                scrollBy(lastTouchY - nextTouchY, event)
                lastTouchY = nextTouchY
              },
              { passive: false },
            )
            const clearTouch = () => {
              lastTouchY = undefined
            }
            document.addEventListener('touchend', clearTouch, { passive: true })
            document.addEventListener('touchcancel', clearTouch, {
              passive: true,
            })
          }

          rendition.on('rendered', attachContentScrollBridge)
          removeContentScrollBridge = () => {
            rendition.off('rendered', attachContentScrollBridge)
            scrollContainer?.removeEventListener(
              'scroll',
              scheduleChapterProgressUpdate,
            )
            cancelAnimationFrame(progressFrame ?? 0)
            contentDocuments.clear()
            renderedViews.clear()
          }
        }

        const navigation = await epubBook.loaded.navigation
        if (isCancelled) return
        const navigationItems = navigation.toc as TocItem[]
        tocRef.current = navigationItems
        setToc(navigationItems)

        function handleRelocated(location: ReaderLocation) {
          const nextProgress = locationsReady
            ? Math.max(
                0,
                Math.min(
                  1,
                  epubBook.locations.percentageFromCfi(location.start.cfi),
                ),
              )
            : bookRecord.progress
          const nextChapter = findChapterLabel(
            tocRef.current,
            location.start.href,
          )
          setCurrentHref(location.start.href)
          if (readerFlow === 'paginated') {
            const nextChapterProgress = getChapterProgress(location)
            setChapterProgress(nextChapterProgress)
            setAtChapterStart(nextChapterProgress <= 0)
            setAtChapterEnd(nextChapterProgress >= 1)
          } else {
            updateScrolledChapterProgress?.()
          }
          setChapterLabel(nextChapter)
          currentChapterLabel = nextChapter
          currentLocationRef.current = location.start.cfi
          pendingReadingState = {
            location: location.start.cfi,
            progress: nextProgress,
            chapterLabel: nextChapter,
          }
          clearTimeout(persistTimer)
          persistTimer = setTimeout(persistReadingState, 350)
        }
        rendition.on('relocated', handleRelocated)
        removeRelocationListener = () => {
          rendition.off('relocated', handleRelocated)
        }

        await rendition.display(currentLocationRef.current)
        if (isCancelled) return
        setIsOpening(false)

        // Location generation walks the whole book and can be slow for large
        // EPUBs. It is only needed for whole-book progress, so keep it off the
        // critical path that renders the saved reading location.
        try {
          await epubBook.locations.generate(1200)
          if (isCancelled) return
          locationsReady = true

          const currentLocation = currentLocationRef.current
          if (currentLocation) {
            pendingReadingState = {
              location: currentLocation,
              progress: Math.max(
                0,
                Math.min(
                  1,
                  epubBook.locations.percentageFromCfi(currentLocation),
                ),
              ),
              chapterLabel: currentChapterLabel,
            }
            clearTimeout(persistTimer)
            persistTimer = setTimeout(persistReadingState, 350)
          }
        } catch {
          // The book remains readable even if its global progress cannot be indexed.
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
      removeContentSettingsDismissal?.()
      removeRelocationListener?.()
      effectRendition?.destroy()
      effectBook?.destroy()
      releaseSanitizedFontStyles?.()
      if (renditionRef.current === effectRendition) {
        renditionRef.current = null
      }
      viewer.replaceChildren()
    }
  }, [bookRecord.id, readerFlow])

  useEffect(() => {
    const rendition = renditionRef.current
    if (rendition) {
      registerReaderTheme(
        rendition,
        theme,
        font,
        fontSize,
        readerFlow,
        lineHeight,
        readerWidth,
        paragraphStyle,
      )
    }
  }, [
    font,
    fontSize,
    lineHeight,
    paragraphStyle,
    readerFlow,
    readerWidth,
    theme,
  ])

  useEffect(() => {
    if (readerFlow !== 'paginated' || typeof ResizeObserver === 'undefined') {
      return
    }

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
      })
    })
    resizeObserver.observe(viewer)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(resizeFrame ?? 0)
    }
  }, [bookRecord.id, readerFlow])

  useEffect(() => {
    if (readerFlow !== 'paginated') return

    function handlePaginationKeyDown(event: KeyboardEvent) {
      if (
        !keyboardPaginationRef.current ||
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
        paginationNavigationRef.current('previous')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        paginationNavigationRef.current('next')
      }
    }

    document.addEventListener('keydown', handlePaginationKeyDown)
    return () => document.removeEventListener('keydown', handlePaginationKeyDown)
  }, [readerFlow])

  async function searchBookContent(
    query: string,
    signal: AbortSignal,
    onProgress: (progress: { completed: number; total: number }) => void,
  ): Promise<BookSearchResult[]> {
    const source = searchSourceRef.current
    if (!source || source.bookId !== bookRecord.id) {
      throw new Error('正文还在准备中，请稍后再试。')
    }

    let searchBookEntry = searchBookRef.current
    if (!searchBookEntry || searchBookEntry.bookId !== bookRecord.id) {
      searchBookEntry?.book.destroy()
      searchBookEntry = {
        bookId: bookRecord.id,
        book: ePub(source.data.slice(0)),
      }
      searchBookRef.current = searchBookEntry
    }

    const searchBook = searchBookEntry.book
    try {
      await searchBook.ready
    } catch {
      if (searchBookRef.current?.book === searchBook) {
        searchBookRef.current = undefined
      }
      searchBook.destroy()
      throw new Error('无法读取这本书的正文。')
    }
    if (signal.aborted) throw new DOMException('搜索已取消', 'AbortError')

    const sections: EpubSection[] = []
    searchBook.spine.each((section: EpubSection) => {
      if (section.linear) sections.push(section)
    })
    onProgress({ completed: 0, total: sections.length })

    const results: BookSearchResult[] = []
    const request = searchBook.load.bind(searchBook)
    for (let index = 0; index < sections.length; index += 1) {
      if (signal.aborted) throw new DOMException('搜索已取消', 'AbortError')
      const section = sections[index]
      try {
        await section.load(request)
        if (signal.aborted) {
          throw new DOMException('搜索已取消', 'AbortError')
        }
        const matches = findSectionMatches(section, query)
        const chapter =
          findChapterLabel(tocRef.current, section.href) ||
          `第 ${index + 1} 节`
        matches.forEach((match) => {
          results.push({
            cfi: match.cfi,
            chapter,
            excerpt: match.excerpt || query,
            href: section.href,
          })
        })
      } finally {
        section.unload()
      }
      onProgress({ completed: index + 1, total: sections.length })
    }

    return results
  }

  function handleNavigationToggle(panel: NavigationPanel) {
    setSettingsOpen(false)
    if (tocOpen && navigationPanel === panel) {
      setTocOpen(false)
      return
    }
    setNavigationPanel(panel)
    setTocOpen(true)
  }

  function displayChapter(href: string) {
    setChapterProgress(0)
    setAtChapterStart(false)
    setAtChapterEnd(false)
    void renditionRef.current?.display(href)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function displaySearchResult(result: BookSearchResult) {
    setChapterProgress(0)
    setAtChapterStart(false)
    setAtChapterEnd(false)
    void renditionRef.current?.display(result.cfi)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function handleReaderFlowChange(flow: ReaderFlow) {
    setAtChapterStart(false)
    setAtChapterEnd(false)
    setReaderFlow(flow)
    try {
      localStorage.setItem(READER_FLOW_STORAGE_KEY, flow)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleFontSizeChange(size: number) {
    setFontSize(size)
    try {
      localStorage.setItem(READER_FONT_SIZE_STORAGE_KEY, String(size))
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleFontChange(nextFont: ReaderFont) {
    setFont(nextFont)
    try {
      localStorage.setItem(READER_FONT_STORAGE_KEY, JSON.stringify(nextFont))
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleThemeChange(nextTheme: ReaderTheme) {
    setTheme(nextTheme)
    try {
      localStorage.setItem(READER_THEME_STORAGE_KEY, nextTheme)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleLineHeightChange(nextLineHeight: ReaderLineHeight) {
    setLineHeight(nextLineHeight)
    try {
      localStorage.setItem(READER_LINE_HEIGHT_STORAGE_KEY, nextLineHeight)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleReaderWidthChange(nextReaderWidth: ReaderWidth) {
    setReaderWidth(nextReaderWidth)
    try {
      localStorage.setItem(READER_WIDTH_STORAGE_KEY, nextReaderWidth)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleParagraphStyleChange(nextStyle: ReaderParagraphStyle) {
    setParagraphStyle(nextStyle)
    try {
      localStorage.setItem(READER_PARAGRAPH_STYLE_STORAGE_KEY, nextStyle)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleKeyboardPaginationChange(enabled: boolean) {
    setKeyboardPagination(enabled)
    try {
      localStorage.setItem(KEYBOARD_PAGINATION_STORAGE_KEY, String(enabled))
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  function handleClickPaginationChange(enabled: boolean) {
    setClickPagination(enabled)
    try {
      localStorage.setItem(CLICK_PAGINATION_STORAGE_KEY, String(enabled))
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  const chapterPercent = Math.round(chapterProgress * 100)
  const chapterNeighbors = currentHref
    ? findChapterNeighbors(toc, currentHref)
    : {}
  const previousChapter = chapterNeighbors.previous
  const nextChapter = chapterNeighbors.next
  const shouldOfferPreviousChapter =
    readerFlow === 'chapter' && atChapterStart && Boolean(previousChapter)
  const shouldOfferNextChapter =
    readerFlow !== 'continuous' && atChapterEnd && Boolean(nextChapter)

  function handleForward() {
    if (atChapterEnd && nextChapter) {
      displayChapter(nextChapter.href)
      return
    }
    void renditionRef.current?.next()
  }

  paginationNavigationRef.current = (direction) => {
    if (direction === 'previous') {
      void renditionRef.current?.prev()
      return
    }
    handleForward()
  }

  const readerLayoutStyle = {
    '--reader-column-width': `${READER_WIDTHS[readerWidth]}px`,
  } as CSSProperties

  return (
    <main className={`reader-page theme-${theme}`} style={readerLayoutStyle}>
      <div
        className={
          tocOpen
            ? `reader-layout toc-is-open ${navigationPanel}-is-open`
            : 'reader-layout'
        }
      >
        {tocOpen ? (
          <>
            {navigationPanel === 'toc' ? (
              <TocPanel
                items={toc}
                currentHref={currentHref}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onSearch={() => setNavigationPanel('search')}
                onSelect={displayChapter}
              />
            ) : (
              <BookSearchPanel
                bookId={bookRecord.id}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onSearch={searchBookContent}
                onSelect={displaySearchResult}
                onShowToc={() => setNavigationPanel('toc')}
              />
            )}
            <button
              className="toc-backdrop"
              type="button"
              aria-label="关闭书内导航"
              onClick={() => setTocOpen(false)}
            />
          </>
        ) : null}

        <section className="reader-main">
          <header className="reader-header">
            <div className="reader-context" aria-live="polite">
              {!tocOpen ? (
                <button
                  className="sidebar-toggle"
                  type="button"
                  onClick={() => setTocOpen(true)}
                >
                  <PanelLeftOpen
                    aria-hidden="true"
                    size={19}
                    strokeWidth={1.7}
                  />
                  <span className="visually-hidden">打开书内导航</span>
                </button>
              ) : null}
              <strong>{bookRecord.title}</strong>
              <span aria-hidden="true">/</span>
              <span>{chapterLabel || '正在打开…'}</span>
            </div>
            <div className="reader-tools">
              <button
                className="reader-tool-button"
                type="button"
                aria-pressed={tocOpen && navigationPanel === 'toc'}
                onClick={() => handleNavigationToggle('toc')}
              >
                <List aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>目录</span>
              </button>
              <button
                className="reader-tool-button"
                type="button"
                aria-pressed={tocOpen && navigationPanel === 'search'}
                onClick={() => handleNavigationToggle('search')}
              >
                <Search aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>搜索</span>
              </button>
              <div className="settings-anchor" ref={settingsAnchorRef}>
                <button
                  className="reader-tool-button"
                  type="button"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  <Settings aria-hidden="true" size={18} strokeWidth={1.7} />
                  <span>阅读设置</span>
                </button>
                {settingsOpen ? (
                  <ReaderSettings
                    font={font}
                    fontSize={fontSize}
                    flow={readerFlow}
                    lineHeight={lineHeight}
                    readerWidth={readerWidth}
                    paragraphStyle={paragraphStyle}
                    keyboardPagination={keyboardPagination}
                    clickPagination={clickPagination}
                    theme={theme}
                    onFontChange={handleFontChange}
                    onFontSizeChange={handleFontSizeChange}
                    onFlowChange={handleReaderFlowChange}
                    onLineHeightChange={handleLineHeightChange}
                    onReaderWidthChange={handleReaderWidthChange}
                    onParagraphStyleChange={handleParagraphStyleChange}
                    onKeyboardPaginationChange={
                      handleKeyboardPaginationChange
                    }
                    onClickPaginationChange={handleClickPaginationChange}
                    onThemeChange={handleThemeChange}
                  />
                ) : null}
              </div>
            </div>
          </header>

          <div
            className={
              readerFlow === 'paginated'
                ? 'reader-stage'
                : 'reader-stage is-scroll-flow'
            }
            aria-busy={isOpening}
          >
            {error ? (
              <div className="reader-error" role="alert">
                <h1>没有打开这本书</h1>
                <p>{error}</p>
                <button type="button" onClick={onBack}>
                  返回书架
                </button>
              </div>
            ) : (
              <>
                <div ref={viewerRef} className="epub-viewer" />
                {readerFlow === 'paginated' &&
                clickPagination &&
                !isOpening ? (
                  <>
                    <button
                      className="page-turn-zone is-previous"
                      type="button"
                      aria-label="点击左侧区域翻到上一页"
                      onClick={() =>
                        paginationNavigationRef.current('previous')
                      }
                    >
                      <ChevronLeft
                        aria-hidden="true"
                        size={22}
                        strokeWidth={1.5}
                      />
                    </button>
                    <button
                      className="page-turn-zone is-next"
                      type="button"
                      aria-label="点击右侧区域翻到下一页"
                      onClick={() => paginationNavigationRef.current('next')}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        size={22}
                        strokeWidth={1.5}
                      />
                    </button>
                  </>
                ) : null}
                {isOpening ? (
                  <div
                    className="reader-loading"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="reader-loading-spinner" aria-hidden="true" />
                    <strong>{openingMessage}</strong>
                    <span>较大的书籍可能需要一点时间</span>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <footer
            className={`reader-footer${
              readerFlow === 'paginated' ? ' is-paginated' : ''
            }${shouldOfferPreviousChapter ? ' is-chapter-start' : ''}${
              shouldOfferNextChapter ? ' is-chapter-end' : ''
            }`}
            aria-label={
              readerFlow === 'paginated'
                ? '阅读进度与翻页'
                : shouldOfferPreviousChapter || shouldOfferNextChapter
                  ? '阅读进度与章节导航'
                  : '阅读进度'
            }
          >
            {readerFlow === 'paginated' ? (
              <button
                type="button"
                onClick={() => void renditionRef.current?.prev()}
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
                上一页
              </button>
            ) : shouldOfferPreviousChapter && previousChapter ? (
              <button
                className="chapter-previous-button"
                type="button"
                aria-label={`进入上一章：${previousChapter.label}`}
                onClick={() => displayChapter(previousChapter.href)}
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
                上一章
                <span className="chapter-boundary-label">
                  · {previousChapter.label}
                </span>
              </button>
            ) : null}
            <span
              className="reader-chapter-progress"
              aria-label={`本章进度 ${chapterPercent}%`}
            >
              {chapterPercent}%
            </span>
            {readerFlow === 'paginated' ? (
              <button
                className={shouldOfferNextChapter ? 'chapter-next-button' : ''}
                type="button"
                aria-label={
                  atChapterEnd && nextChapter
                    ? `进入下一章：${nextChapter.label}`
                    : '下一页'
                }
                onClick={handleForward}
              >
                {atChapterEnd && nextChapter ? (
                  <>
                    下一章
                    <span className="chapter-boundary-label">
                      · {nextChapter.label}
                    </span>
                  </>
                ) : (
                  '下一页'
                )}
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
              </button>
            ) : shouldOfferNextChapter && nextChapter ? (
              <button
                className="chapter-next-button"
                type="button"
                aria-label={`进入下一章：${nextChapter.label}`}
                onClick={() => displayChapter(nextChapter.href)}
              >
                下一章
                <span className="chapter-boundary-label">
                  · {nextChapter.label}
                </span>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
              </button>
            ) : null}
          </footer>
          <div className="reader-progress" aria-hidden="true">
            <span style={{ width: `${chapterPercent}%` }} />
          </div>
        </section>
      </div>
    </main>
  )
}
