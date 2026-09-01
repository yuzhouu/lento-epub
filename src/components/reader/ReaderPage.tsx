import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import {
  ChevronLeft,
  ChevronRight,
  List,
  PanelLeftOpen,
  Settings,
} from 'lucide-react'
import { getBookFile, updateBookReadingState } from '../../lib/book-storage'
import {
  ReaderSettings,
  type ReaderFlow,
  type ReaderTheme,
} from './ReaderSettings'
import { TocPanel } from './TocPanel'
import type {
  BookRecord,
  ReaderLocation,
  TocItem,
} from '../../types/book'

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>

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
const READER_FONT_SIZE_STORAGE_KEY = 'lento:reader-font-size:v1'
const READER_THEME_STORAGE_KEY = 'lento:reader-theme:v1'
const DEFAULT_READER_FONT_SIZE = 18
const MIN_READER_FONT_SIZE = 15
const MAX_READER_FONT_SIZE = 26

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

function findChapterLabel(
  items: TocItem[],
  href: string,
): string | undefined {
  for (const item of items) {
    if (href === item.href || href.endsWith(item.href)) return item.label.trim()
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
  fontSize: number,
  flow: ReaderFlow,
) {
  const colors = THEME_COLORS[theme]
  rendition.themes.register('lento', {
    body: {
      color: `${colors.color} !important`,
      background: `${colors.background} !important`,
      'font-family':
        '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif !important',
      'line-height': '2.05 !important',
      padding:
        flow === 'paginated'
          ? '0 4vw !important'
          : '0 min(4vw, 30px) !important',
      ...(flow !== 'paginated'
        ? {
            width: 'min(760px, calc(100% - 8px)) !important',
            margin: '0 auto !important',
            'box-sizing': 'border-box !important',
          }
        : {}),
    },
    p: {
      'font-size': `${fontSize}px !important`,
      'line-height': '2.05 !important',
      'text-align': 'justify',
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
  const tocRef = useRef<TocItem[]>([])
  const currentLocationRef = useRef(bookRecord.location)
  const currentBookIdRef = useRef(bookRecord.id)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 980)
  const [currentHref, setCurrentHref] = useState<string>()
  const [chapterLabel, setChapterLabel] = useState(bookRecord.chapterLabel)
  const [chapterProgress, setChapterProgress] = useState(0)
  const [atChapterStart, setAtChapterStart] = useState(false)
  const [atChapterEnd, setAtChapterEnd] = useState(false)
  const [fontSize, setFontSize] = useState(getInitialReaderFontSize)
  const [readerFlow, setReaderFlow] = useState<ReaderFlow>(getInitialReaderFlow)
  const [theme, setTheme] = useState<ReaderTheme>(getInitialReaderTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(true)
  const [openingMessage, setOpeningMessage] = useState('正在读取书籍…')
  const [error, setError] = useState<string>()

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
        setOpeningMessage('正在排版正文…')

        const epubBook = ePub(data.slice(0))
        const rendition = epubBook.renderTo(viewerElement, {
          width: '100%',
          height: '100%',
          manager: readerFlow === 'continuous' ? 'continuous' : 'default',
          flow: readerFlow === 'paginated' ? 'paginated' : 'scrolled',
          spread: 'none',
        })
        effectBook = epubBook
        effectRendition = rendition
        renditionRef.current = rendition
        registerReaderTheme(rendition, theme, fontSize, readerFlow)

        const settingsDocuments = new Set<Document>()
        function attachSettingsDismissal(
          _section: unknown,
          view: { document?: Document },
        ) {
          const contentDocument = view.document
          if (!contentDocument || settingsDocuments.has(contentDocument)) return
          settingsDocuments.add(contentDocument)
          contentDocument.addEventListener('pointerdown', closeReaderSettings)
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
      if (renditionRef.current === effectRendition) {
        renditionRef.current = null
      }
      viewer.replaceChildren()
    }
  }, [bookRecord.id, readerFlow])

  useEffect(() => {
    const rendition = renditionRef.current
    if (rendition) registerReaderTheme(rendition, theme, fontSize, readerFlow)
  }, [fontSize, readerFlow, theme])

  function displayChapter(href: string) {
    setChapterProgress(0)
    setAtChapterStart(false)
    setAtChapterEnd(false)
    void renditionRef.current?.display(href)
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

  function handleThemeChange(nextTheme: ReaderTheme) {
    setTheme(nextTheme)
    try {
      localStorage.setItem(READER_THEME_STORAGE_KEY, nextTheme)
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

  return (
    <main className={`reader-page theme-${theme}`}>
      <div className={tocOpen ? 'reader-layout toc-is-open' : 'reader-layout'}>
        {tocOpen ? (
          <>
            <TocPanel
              items={toc}
              currentHref={currentHref}
              onBack={onBack}
              onClose={() => setTocOpen(false)}
              onSelect={displayChapter}
            />
            <button
              className="toc-backdrop"
              type="button"
              aria-label="关闭目录"
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
                  <span className="visually-hidden">打开目录</span>
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
                aria-pressed={tocOpen}
                onClick={() => setTocOpen((open) => !open)}
              >
                <List aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>目录</span>
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
                    fontSize={fontSize}
                    flow={readerFlow}
                    theme={theme}
                    onFontSizeChange={handleFontSizeChange}
                    onFlowChange={handleReaderFlowChange}
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
