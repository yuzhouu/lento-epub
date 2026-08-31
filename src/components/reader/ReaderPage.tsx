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
import { ReaderSettings, type ReaderTheme } from './ReaderSettings'
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
  const bookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<EpubRendition | null>(null)
  const tocRef = useRef<TocItem[]>([])
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 980)
  const [currentHref, setCurrentHref] = useState<string>()
  const [chapterLabel, setChapterLabel] = useState(bookRecord.chapterLabel)
  const [progress, setProgress] = useState(bookRecord.progress)
  const [fontSize, setFontSize] = useState(19)
  const [theme, setTheme] = useState<ReaderTheme>('paper')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    let isCancelled = false

    async function openBook(viewerElement: HTMLDivElement) {
      try {
        const data = await getBookFile(bookRecord.id)
        if (!data) throw new Error('找不到原始 EPUB 文件。')
        if (isCancelled) return

        const epubBook = ePub(data.slice(0))
        const rendition = epubBook.renderTo(viewerElement, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
        })
        bookRef.current = epubBook
        renditionRef.current = rendition
        registerReaderTheme(rendition, theme, fontSize)

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
          void updateBookReadingState(bookRecord.id, {
            location: location.start.cfi,
            progress: nextProgress,
            chapterLabel: nextChapter,
          }).then((updatedBook) => {
            if (updatedBook) onBookUpdate(updatedBook)
          })
        })

        await rendition.display(bookRecord.location)
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
      renditionRef.current?.destroy()
      bookRef.current?.destroy()
      renditionRef.current = null
      bookRef.current = null
      viewer.replaceChildren()
    }
  }, [bookRecord.id])

  useEffect(() => {
    const rendition = renditionRef.current
    if (rendition) registerReaderTheme(rendition, theme, fontSize)
  }, [fontSize, theme])

  function displayChapter(href: string) {
    void renditionRef.current?.display(href)
    if (window.innerWidth < 980) setTocOpen(false)
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
                    theme={theme}
                    onFontSizeChange={setFontSize}
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

          <footer className="reader-footer">
            <button
              type="button"
              onClick={() => void renditionRef.current?.prev()}
            >
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
              上一页
            </button>
            <span>{percent}%</span>
            <button
              type="button"
              onClick={() => void renditionRef.current?.next()}
            >
              下一页
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
            </button>
          </footer>
          <div className="reader-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        </section>
      </div>
    </main>
  )
}
