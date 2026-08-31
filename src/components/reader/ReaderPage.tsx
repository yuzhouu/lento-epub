import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
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

const READER_FLOW_STORAGE_KEY = 'lento:reader-flow:v1'

function getInitialReaderFlow(): ReaderFlow {
  try {
    return localStorage.getItem(READER_FLOW_STORAGE_KEY) === 'paginated'
      ? 'paginated'
      : 'scrolled'
  } catch {
    return 'scrolled'
  }
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

function registerReaderTheme(
  rendition: EpubRendition,
  theme: ReaderTheme,
  fontSize: number,
) {
  const colors = THEME_COLORS[theme]
  rendition.themes.register('lento', {
    body: {
      color: `${colors.color} !important`,
      background: `${colors.background} !important`,
      'font-family':
        '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif !important',
      'line-height': '2.05 !important',
      padding: '0 4vw !important',
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
  const renditionRef = useRef<EpubRendition | null>(null)
  const tocRef = useRef<TocItem[]>([])
  const currentLocationRef = useRef(bookRecord.location)
  const currentBookIdRef = useRef(bookRecord.id)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 980)
  const [currentHref, setCurrentHref] = useState<string>()
  const [chapterLabel, setChapterLabel] = useState(bookRecord.chapterLabel)
  const [progress, setProgress] = useState(bookRecord.progress)
  const [fontSize, setFontSize] = useState(19)
  const [readerFlow, setReaderFlow] = useState<ReaderFlow>(getInitialReaderFlow)
  const [theme, setTheme] = useState<ReaderTheme>('paper')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (currentBookIdRef.current !== bookRecord.id) {
      currentBookIdRef.current = bookRecord.id
      currentLocationRef.current = bookRecord.location
    }
    setError(undefined)

    let isCancelled = false
    let effectBook: EpubBook | null = null
    let effectRendition: EpubRendition | null = null
    let removeContentScrollBridge: (() => void) | undefined
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

        const epubBook = ePub(data.slice(0))
        const rendition = epubBook.renderTo(viewerElement, {
          width: '100%',
          height: '100%',
          manager: readerFlow === 'scrolled' ? 'continuous' : 'default',
          flow: readerFlow === 'scrolled' ? 'scrolled' : 'paginated',
          spread: 'none',
        })
        effectBook = epubBook
        effectRendition = rendition
        renditionRef.current = rendition
        registerReaderTheme(rendition, theme, fontSize)

        if (readerFlow === 'scrolled') {
          const contentDocuments = new Set<Document>()
          let lastTouchY: number | undefined

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

          function attachContentScrollBridge(
            _section: unknown,
            view: { document?: Document },
          ) {
            const document = view.document
            if (!document || contentDocuments.has(document)) return
            contentDocuments.add(document)

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
            contentDocuments.clear()
          }
        }

        const navigation = await epubBook.loaded.navigation
        if (isCancelled) return
        const navigationItems = navigation.toc as TocItem[]
        tocRef.current = navigationItems
        setToc(navigationItems)

        await epubBook.locations.generate(1200)
        if (isCancelled) return

        rendition.on('relocated', (location: ReaderLocation) => {
          const nextProgress = Math.max(
            0,
            Math.min(1, epubBook.locations.percentageFromCfi(location.start.cfi)),
          )
          const nextChapter = findChapterLabel(
            tocRef.current,
            location.start.href,
          )
          setCurrentHref(location.start.href)
          setProgress(nextProgress)
          setChapterLabel(nextChapter)
          currentLocationRef.current = location.start.cfi
          pendingReadingState = {
            location: location.start.cfi,
            progress: nextProgress,
            chapterLabel: nextChapter,
          }
          clearTimeout(persistTimer)
          persistTimer = setTimeout(persistReadingState, 350)
        })

        await rendition.display(currentLocationRef.current)
      } catch (readerError) {
        if (!isCancelled) {
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
    if (rendition) registerReaderTheme(rendition, theme, fontSize)
  }, [fontSize, theme])

  function displayChapter(href: string) {
    void renditionRef.current?.display(href)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function handleReaderFlowChange(flow: ReaderFlow) {
    setReaderFlow(flow)
    try {
      localStorage.setItem(READER_FLOW_STORAGE_KEY, flow)
    } catch {
      // Reading still works when local storage is unavailable.
    }
  }

  const percent = Math.round(progress * 100)

  return (
    <main className={`reader-page theme-${theme}`}>
      <div className={tocOpen ? 'reader-layout toc-is-open' : 'reader-layout'}>
        {tocOpen ? (
          <TocPanel
            items={toc}
            currentHref={currentHref}
            onClose={() => setTocOpen(false)}
            onSelect={displayChapter}
          />
        ) : null}

        <section className="reader-main">
          <header className="reader-header">
            <button className="back-button" type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" size={19} strokeWidth={1.5} />
              返回书架
            </button>
            <div className="reader-position" aria-live="polite">
              <strong>{bookRecord.title}</strong>
              <span>{chapterLabel || '正在打开…'}</span>
            </div>
            <div className="reader-tools">
              <button
                className="icon-button"
                type="button"
                aria-pressed={tocOpen}
                onClick={() => setTocOpen((open) => !open)}
              >
                <List aria-hidden="true" size={22} strokeWidth={1.5} />
                <span className="visually-hidden">打开目录</span>
              </button>
              <div className="settings-anchor">
                <button
                  className="icon-button"
                  type="button"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  <Settings aria-hidden="true" size={21} strokeWidth={1.5} />
                  <span className="visually-hidden">阅读设置</span>
                </button>
                {settingsOpen ? (
                  <ReaderSettings
                    fontSize={fontSize}
                    flow={readerFlow}
                    theme={theme}
                    onFontSizeChange={setFontSize}
                    onFlowChange={handleReaderFlowChange}
                    onThemeChange={setTheme}
                  />
                ) : null}
              </div>
            </div>
          </header>

          <div className="reader-stage">
            {error ? (
              <div className="reader-error" role="alert">
                <h1>没有打开这本书</h1>
                <p>{error}</p>
                <button type="button" onClick={onBack}>
                  返回书架
                </button>
              </div>
            ) : (
              <div ref={viewerRef} className="epub-viewer" />
            )}
          </div>

          <footer
            className={
              readerFlow === 'paginated'
                ? 'reader-footer is-paginated'
                : 'reader-footer'
            }
            aria-label={`阅读进度 ${percent}%`}
          >
            {readerFlow === 'paginated' ? (
              <button
                type="button"
                onClick={() => void renditionRef.current?.prev()}
              >
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
                上一页
              </button>
            ) : null}
            <span>{percent}%</span>
            {readerFlow === 'paginated' ? (
              <button
                type="button"
                onClick={() => void renditionRef.current?.next()}
              >
                下一页
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
              </button>
            ) : null}
          </footer>
          <div className="reader-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        </section>
      </div>
    </main>
  )
}
