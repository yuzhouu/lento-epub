import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ePub from 'epubjs'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  List,
  NotebookPen,
  PanelLeftOpen,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import {
  deleteReadingAsset,
  getBookFile,
  getReadingAssets,
  saveReadingAsset,
  updateBookReadingState,
  updateReadingHighlight,
} from '../../lib/book-storage'
import { sanitizeEpubFontSources } from '../../lib/epub-font-sanitizer'
import {
  downloadReadingAssets,
  type ReadingAssetExportFormat,
} from '../../lib/reading-asset-export'
import {
  NOTE_HIGHLIGHT_COLOR,
  QUICK_HIGHLIGHT_COLOR_OPTIONS,
} from '../../lib/reading-highlight-colors'
import {
  DEFAULT_READING_HIGHLIGHT_STYLE,
  READING_HIGHLIGHT_STYLE_OPTIONS,
} from '../../lib/reading-highlight-styles'
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
import { ReadingAssetsPanel } from './ReadingAssetsPanel'
import { ReadingHighlightStyleIcon } from './ReadingHighlightStyleIcon'
import type {
  BookRecord,
  ReadingAsset,
  ReadingHighlight,
  ReadingHighlightColor,
  ReadingHighlightStyle,
  ReaderLocation,
  TocItem,
} from '../../types/book'

type EpubBook = ReturnType<typeof ePub>
type EpubRendition = ReturnType<EpubBook['renderTo']>
type EpubSection = ReturnType<EpubBook['spine']['get']>
type NavigationPanel = 'toc' | 'search' | 'assets'

interface PendingSelection {
  cfi: string
  text: string
  href?: string
  chapterLabel?: string
}

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
const HIGHLIGHT_STROKES: Record<ReadingHighlightColor, string> = {
  yellow: '#d3a600',
  orange: '#e97c18',
  lime: '#78a91f',
  green: '#229866',
  cyan: '#168fa9',
  blue: '#4f7fd1',
  rose: '#d95470',
  violet: '#8461d1',
}

interface EpubSvgMark {
  element?: SVGGElement
  render?: () => void
  lentoDecorationAttached?: boolean
}

interface EpubAnnotationHandle {
  mark?: EpubSvgMark
  on(event: 'attach', listener: (mark: EpubSvgMark) => void): void
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  document: Document,
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', name)
}

function createWavyUnderlinePath(x: number, y: number, width: number): string {
  const end = x + width
  const halfWaveWidth = 4.6
  const amplitude = 1.5
  let cursor = x
  let direction = -1
  let path = `M ${x} ${y}`

  while (cursor < end) {
    const next = Math.min(cursor + halfWaveWidth, end)
    const span = next - cursor
    const waveY = y + direction * amplitude
    path += ` C ${cursor + span * 0.28} ${waveY} ${cursor + span * 0.72} ${waveY} ${next} ${y}`
    cursor = next
    direction *= -1
  }

  return path
}

function decorateReadingMark(
  mark: EpubSvgMark,
  highlight: ReadingHighlight,
) {
  const group = mark.element
  if (!group) return

  group
    .querySelectorAll('.lento-annotation-decoration')
    .forEach((element) => element.remove())

  const stroke = HIGHLIGHT_STROKES[highlight.color]
  const lineStyle =
    highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE
  const geometryRects = Array.from(group.children).filter(
    (element): element is SVGRectElement =>
      element.tagName.toLocaleLowerCase() === 'rect',
  )

  geometryRects.forEach((rect) => {
    const x = Number(rect.getAttribute('x'))
    const y = Number(rect.getAttribute('y'))
    const width = Number(rect.getAttribute('width'))
    const height = Number(rect.getAttribute('height'))
    if (![x, y, width, height].every(Number.isFinite) || width <= 0) return

    rect.setAttribute('fill', 'transparent')
    rect.setAttribute('stroke', 'none')

    if (lineStyle === 'double') {
      const bottomOffsets = [3.25, 1.05]
      bottomOffsets.forEach((bottomOffset) => {
        const line = createSvgElement(group.ownerDocument, 'line')
        line.classList.add(
          'lento-annotation-decoration',
          'lento-annotation-double',
        )
        line.setAttribute('x1', String(x))
        line.setAttribute('x2', String(x + width))
        line.setAttribute('y1', String(y + height - bottomOffset))
        line.setAttribute('y2', String(y + height - bottomOffset))
        line.setAttribute('stroke', stroke)
        line.setAttribute('stroke-width', '1.25')
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('vector-effect', 'non-scaling-stroke')
        group.append(line)
      })
      return
    }

    if (lineStyle === 'single') {
      const line = createSvgElement(group.ownerDocument, 'line')
      line.classList.add(
        'lento-annotation-decoration',
        'lento-annotation-single',
      )
      line.setAttribute('x1', String(x))
      line.setAttribute('x2', String(x + width))
      line.setAttribute('y1', String(y + height - 1.2))
      line.setAttribute('y2', String(y + height - 1.2))
      line.setAttribute('stroke', stroke)
      line.setAttribute('stroke-width', '1.7')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      group.append(line)
      return
    }

    const path = createSvgElement(group.ownerDocument, 'path')
    path.classList.add(
      'lento-annotation-decoration',
      'lento-annotation-wave',
    )
    path.setAttribute(
      'd',
      createWavyUnderlinePath(x, y + height - 1.5, width),
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', '1.7')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    group.append(path)
  })
}

function attachReadingMarkDecoration(
  mark: EpubSvgMark,
  highlight: ReadingHighlight,
) {
  if (!mark.render || mark.lentoDecorationAttached) {
    decorateReadingMark(mark, highlight)
    return
  }

  const render = mark.render.bind(mark)
  mark.render = () => {
    render()
    decorateReadingMark(mark, highlight)
  }
  mark.lentoDecorationAttached = true
  decorateReadingMark(mark, highlight)
}

function renderReadingHighlight(
  rendition: EpubRendition,
  highlight: ReadingHighlight,
  onOpen: (highlight: ReadingHighlight) => void,
) {
  const annotation = rendition.annotations.highlight(
    highlight.cfi,
    { assetId: highlight.id },
    () => onOpen(highlight),
    'lento-reading-highlight',
    {
      fill: 'transparent',
      'fill-opacity': '0',
      'mix-blend-mode': 'normal',
    },
  ) as unknown as EpubAnnotationHandle | undefined
  if (!annotation) return
  const decorate = (mark: EpubSvgMark) =>
    attachReadingMarkDecoration(mark, highlight)
  annotation.on('attach', decorate)
  if (annotation.mark) decorate(annotation.mark)
}

function attachReadingHighlightHover(contentDocument: Document) {
  const frameElement = contentDocument.defaultView?.frameElement
  if (!(frameElement instanceof HTMLIFrameElement)) return () => undefined
  const iframe = frameElement

  let hoverFrame: number | undefined
  let pointerX = 0
  let pointerY = 0
  let hoveredMark: SVGGElement | undefined

  function clearHoveredMark() {
    hoveredMark?.classList.remove('is-hovered')
    hoveredMark = undefined
  }

  function updateHoveredMark() {
    hoverFrame = undefined
    const frameBounds = iframe.getBoundingClientRect()
    const pointX = frameBounds.left + pointerX
    const pointY = frameBounds.top + pointerY
    const nextHoveredMark = Array.from(
      iframe.parentElement?.querySelectorAll<SVGGElement>(
        'g.lento-reading-highlight',
      ) ?? [],
    ).find((group) =>
      Array.from(group.children).some((element) => {
        if (element.tagName.toLocaleLowerCase() !== 'rect') return false
        const bounds = element.getBoundingClientRect()
        return (
          pointX >= bounds.left &&
          pointX <= bounds.right &&
          pointY >= bounds.top &&
          pointY <= bounds.bottom
        )
      }),
    )
    if (nextHoveredMark === hoveredMark) return
    clearHoveredMark()
    nextHoveredMark?.classList.add('is-hovered')
    hoveredMark = nextHoveredMark
  }

  function handlePointerMove(event: PointerEvent) {
    pointerX = event.clientX
    pointerY = event.clientY
    if (hoverFrame !== undefined) return
    hoverFrame = requestAnimationFrame(updateHoveredMark)
  }

  function handlePointerLeave() {
    cancelAnimationFrame(hoverFrame ?? 0)
    hoverFrame = undefined
    clearHoveredMark()
  }

  contentDocument.addEventListener('pointermove', handlePointerMove, {
    passive: true,
  })
  contentDocument.addEventListener('pointerleave', handlePointerLeave)
  return () => {
    contentDocument.removeEventListener('pointermove', handlePointerMove)
    contentDocument.removeEventListener('pointerleave', handlePointerLeave)
    handlePointerLeave()
  }
}

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
  const pendingSelectionRef = useRef<PendingSelection | undefined>(undefined)
  const pendingSelectionWindowRef = useRef<Window | undefined>(undefined)
  const pendingNoteRef = useRef('')
  const pendingNoteDirtyRef = useRef(false)
  const pendingNoteSaveTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const pendingColorRef = useRef<ReadingHighlightColor | undefined>(undefined)
  const pendingLineStyleRef = useRef<ReadingHighlightStyle>(
    DEFAULT_READING_HIGHLIGHT_STYLE,
  )
  const pendingLineStyleDirtyRef = useRef(false)
  const pendingExistingHighlightRef = useRef<ReadingHighlight | undefined>(
    undefined,
  )
  const pendingSelectionVersionRef = useRef(0)
  const isSavingSelectionRef = useRef(false)
  const closePendingSelectionAfterSaveRef = useRef(false)
  const selectionDraftsRef = useRef<Map<string, string>>(new Map())
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
  const [readingAssets, setReadingAssets] = useState<ReadingAsset[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string>()
  const [activeAssetFocusVersion, setActiveAssetFocusVersion] = useState(0)
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>()
  const [pendingNote, setPendingNote] = useState('')
  const [pendingColor, setPendingColor] = useState<ReadingHighlightColor>()
  const [pendingLineStyle, setPendingLineStyle] =
    useState<ReadingHighlightStyle>(DEFAULT_READING_HIGHLIGHT_STYLE)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [isSavingBookmark, setIsSavingBookmark] = useState(false)
  const [readingAssetError, setReadingAssetError] = useState<string>()
  const [isOpening, setIsOpening] = useState(true)
  const [openingMessage, setOpeningMessage] = useState('正在读取书籍…')
  const [error, setError] = useState<string>()
  const tocOpenRef = useRef(tocOpen)
  const navigationPanelRef = useRef(navigationPanel)

  keyboardPaginationRef.current = keyboardPagination
  pendingNoteRef.current = pendingNote
  pendingColorRef.current = pendingColor
  pendingLineStyleRef.current = pendingLineStyle
  tocOpenRef.current = tocOpen
  navigationPanelRef.current = navigationPanel

  useEffect(() => {
    return () => {
      if (searchBookRef.current?.bookId === bookRecord.id) {
        searchBookRef.current.book.destroy()
        searchBookRef.current = undefined
      }
      if (searchSourceRef.current?.bookId === bookRecord.id) {
        searchSourceRef.current = undefined
      }
      clearPendingNoteSaveTimer()
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
    if (!pendingSelection) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('.selection-editor')
      ) {
        return
      }
      dismissPendingSelection()
    }

    function handlePendingSelectionKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismissPendingSelection()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    document.addEventListener('keydown', handlePendingSelectionKeyDown)
    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true,
      )
      document.removeEventListener('keydown', handlePendingSelectionKeyDown)
    }
  }, [pendingSelection?.cfi])

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
      dismissPendingSelection()
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
      cancelPendingSelection()
      selectionDraftsRef.current.clear()
      currentBookIdRef.current = bookRecord.id
      currentLocationRef.current = bookRecord.location
      setReadingAssets([])
      setActiveAssetId(undefined)
      setPendingSelection(undefined)
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
    let removeSelectionListener: (() => void) | undefined
    let updateScrolledChapterProgress: (() => void) | undefined
    let currentChapterLabel = bookRecord.chapterLabel
    let currentChapterHref: string | undefined
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

        const [data, storedReadingAssets] = await Promise.all([
          getBookFile(bookRecord.id),
          getReadingAssets(bookRecord.id),
        ])
        if (!data) throw new Error('找不到原始 EPUB 文件。')
        if (isCancelled) return
        setReadingAssets(storedReadingAssets)
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

        storedReadingAssets.forEach((asset) => {
          if (asset.kind === 'highlight') {
            renderReadingHighlight(
              rendition,
              asset,
              handleReadingHighlightOpen,
            )
          }
        })

        function handleTextSelected(
          cfi: string,
          contents: { window?: Window },
        ) {
          const contentWindow = contents.window
          const selection = contentWindow?.getSelection()
          const text = selection?.toString().replace(/\s+/g, ' ').trim()
          if (!text || !contentWindow) return

          replacePendingSelection(contentWindow)
          const draft = selectionDraftsRef.current.get(cfi)
          const nextSelection = {
            cfi,
            text,
            href: currentChapterHref,
            chapterLabel: currentChapterLabel,
          }
          const nextNote = draft ?? ''
          pendingSelectionRef.current = nextSelection
          pendingSelectionWindowRef.current = contentWindow
          pendingNoteRef.current = nextNote
          pendingNoteDirtyRef.current = Boolean(nextNote.trim())
          pendingColorRef.current = undefined
          pendingLineStyleRef.current = DEFAULT_READING_HIGHLIGHT_STYLE
          pendingLineStyleDirtyRef.current = false
          pendingExistingHighlightRef.current = undefined
          pendingSelectionVersionRef.current += 1
          setPendingNote(nextNote)
          setPendingColor(undefined)
          setPendingLineStyle(DEFAULT_READING_HIGHLIGHT_STYLE)
          setPendingSelection(nextSelection)
        }
        rendition.on('selected', handleTextSelected)
        removeSelectionListener = () => {
          rendition.off('selected', handleTextSelected)
        }

        const settingsDocuments = new Set<Document>()
        const readingHighlightHoverCleanups = new Map<Document, () => void>()
        function handlePaginationKeyDown(event: KeyboardEvent) {
          if (event.key === 'Escape' && pendingSelectionRef.current) {
            event.preventDefault()
            dismissPendingSelection()
            return
          }
          if (
            event.key.toLocaleLowerCase() === 'f' &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey
          ) {
            event.preventDefault()
            dismissPendingSelection()
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
          readingHighlightHoverCleanups.set(
            contentDocument,
            attachReadingHighlightHover(contentDocument),
          )
          contentDocument.addEventListener(
            'pointerdown',
            handleContentPointerDown,
          )
          contentDocument.addEventListener('keydown', handlePaginationKeyDown)
        }
        function handleContentPointerDown() {
          closeReaderSettings()
          dismissPendingSelection()
        }
        function closeReaderSettings() {
          setSettingsOpen(false)
        }
        rendition.on('rendered', attachSettingsDismissal)
        removeContentSettingsDismissal = () => {
          rendition.off('rendered', attachSettingsDismissal)
          settingsDocuments.forEach((contentDocument) => {
            readingHighlightHoverCleanups.get(contentDocument)?.()
            contentDocument.removeEventListener(
              'pointerdown',
              handleContentPointerDown,
            )
            contentDocument.removeEventListener(
              'keydown',
              handlePaginationKeyDown,
            )
          })
          readingHighlightHoverCleanups.clear()
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
          currentChapterHref = location.start.href
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
      removeSelectionListener?.()
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
    if (typeof ResizeObserver === 'undefined') {
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

  function handleReadingHighlightOpen(highlight: ReadingHighlight) {
    setActiveAssetId(highlight.id)
    setReadingAssetError(undefined)
    setSettingsOpen(false)
    if (
      tocOpenRef.current &&
      navigationPanelRef.current === 'assets'
    ) {
      setActiveAssetFocusVersion((version) => version + 1)
      dismissPendingSelection()
      return
    }

    openReadingHighlightEditor(highlight)
  }

  function openReadingHighlightEditor(highlight: ReadingHighlight) {
    try {
      pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
    } catch {
      // The previous content document may have unloaded during navigation.
    }

    const nextSelection: PendingSelection = {
      cfi: highlight.cfi,
      text: highlight.text,
      href: highlight.href,
      chapterLabel: highlight.chapterLabel,
    }
    selectionDraftsRef.current.delete(highlight.cfi)
    pendingSelectionRef.current = nextSelection
    pendingSelectionWindowRef.current = undefined
    pendingNoteRef.current = highlight.note ?? ''
    pendingNoteDirtyRef.current = false
    pendingColorRef.current = highlight.color
    pendingLineStyleRef.current =
      highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE
    pendingLineStyleDirtyRef.current = false
    pendingExistingHighlightRef.current = highlight
    pendingSelectionVersionRef.current += 1
    setPendingSelection(nextSelection)
    setPendingNote(highlight.note ?? '')
    setPendingColor(highlight.color)
    setPendingLineStyle(
      highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE,
    )
  }

  function resetPendingSelection(options: {
    preserveDraft: boolean
    clearNativeSelection: boolean
  }) {
    clearPendingNoteSaveTimer()
    const pending = pendingSelectionRef.current
    if (!pending) return

    const note = pendingNoteRef.current.trim()
    if (
      options.preserveDraft &&
      note &&
      !pendingExistingHighlightRef.current
    ) {
      selectionDraftsRef.current.set(pending.cfi, note)
    } else {
      selectionDraftsRef.current.delete(pending.cfi)
    }

    if (options.clearNativeSelection) {
      try {
        pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
      } catch {
        // The content document may already have been unloaded after navigation.
      }
    }
    pendingSelectionRef.current = undefined
    pendingSelectionWindowRef.current = undefined
    pendingNoteRef.current = ''
    pendingNoteDirtyRef.current = false
    pendingColorRef.current = undefined
    pendingLineStyleRef.current = DEFAULT_READING_HIGHLIGHT_STYLE
    pendingLineStyleDirtyRef.current = false
    pendingExistingHighlightRef.current = undefined
    closePendingSelectionAfterSaveRef.current = false
    pendingSelectionVersionRef.current += 1
    setPendingSelection(undefined)
    setPendingNote('')
    setPendingColor(undefined)
    setPendingLineStyle(DEFAULT_READING_HIGHLIGHT_STYLE)
    setReadingAssetError(undefined)
  }

  function replacePendingSelection(contentWindow: Window) {
    resetPendingSelection({
      preserveDraft: true,
      clearNativeSelection:
        pendingSelectionWindowRef.current !== contentWindow,
    })
  }

  function clearPendingNoteSaveTimer() {
    clearTimeout(pendingNoteSaveTimerRef.current)
    pendingNoteSaveTimerRef.current = undefined
  }

  function schedulePendingNoteSave() {
    clearPendingNoteSaveTimer()
    pendingNoteSaveTimerRef.current = setTimeout(() => {
      pendingNoteSaveTimerRef.current = undefined
      const selection = pendingSelectionRef.current
      const existing = pendingExistingHighlightRef.current
      if (
        !selection ||
        !pendingNoteDirtyRef.current ||
        (!pendingNoteRef.current.trim() && !existing)
      ) {
        return
      }
      void handleSaveSelection(
        pendingColorRef.current ?? existing?.color ?? NOTE_HIGHLIGHT_COLOR,
      )
    }, 500)
  }

  async function handleDeletePendingHighlight() {
    const existing = pendingExistingHighlightRef.current
    if (!existing || isSavingSelectionRef.current) return
    clearPendingNoteSaveTimer()
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    try {
      if (await handleDeleteAsset(existing)) finishPendingSelection()
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
    }
  }

  function dismissPendingSelection() {
    const existing = pendingExistingHighlightRef.current
    const shouldSaveNote =
      pendingNoteDirtyRef.current &&
      (Boolean(pendingNoteRef.current.trim()) || Boolean(existing))
    const shouldSaveLineStyle =
      pendingLineStyleDirtyRef.current && Boolean(existing)

    if (shouldSaveNote || shouldSaveLineStyle) {
      void handleSaveSelection(
        pendingColorRef.current ?? existing?.color ?? NOTE_HIGHLIGHT_COLOR,
        true,
      )
      return
    }
    resetPendingSelection({
      preserveDraft: true,
      clearNativeSelection: true,
    })
  }

  function cancelPendingSelection() {
    resetPendingSelection({
      preserveDraft: false,
      clearNativeSelection: true,
    })
  }

  function finishPendingSelection(version?: number) {
    if (
      version !== undefined &&
      version !== pendingSelectionVersionRef.current
    ) {
      return
    }
    resetPendingSelection({
      preserveDraft: false,
      clearNativeSelection: true,
    })
  }

  async function handleSaveSelection(
    color: ReadingHighlightColor,
    closeAfterSave = false,
  ) {
    const selection = pendingSelectionRef.current
    if (!selection) return
    if (isSavingSelectionRef.current) {
      if (closeAfterSave) closePendingSelectionAfterSaveRef.current = true
      return
    }
    clearPendingNoteSaveTimer()
    const note = pendingNoteRef.current
    const lineStyle = pendingLineStyleRef.current
    const selectionVersion = pendingSelectionVersionRef.current
    const previousColor = pendingColorRef.current
    pendingColorRef.current = color
    setPendingColor(color)
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    setReadingAssetError(undefined)

    try {
      const existing =
        pendingExistingHighlightRef.current ??
        readingAssets.find(
          (asset): asset is ReadingHighlight =>
            asset.kind === 'highlight' && asset.cfi === selection.cfi,
        )
      if (existing) {
        const updated = await updateReadingHighlight(existing.id, {
          color,
          lineStyle,
          note,
          text: selection.text,
        })
        if (!updated) throw new Error('这条划线已经不存在。')
        pendingExistingHighlightRef.current = updated
        if (renditionRef.current) {
          renditionRef.current.annotations.remove(existing.cfi, 'highlight')
          renderReadingHighlight(
            renditionRef.current,
            updated,
            handleReadingHighlightOpen,
          )
        }
        setReadingAssets((current) =>
          current.map((asset) => (asset.id === updated.id ? updated : asset)),
        )
      } else {
        const now = Date.now()
        const highlight: ReadingHighlight = {
          id: crypto.randomUUID(),
          bookId: bookRecord.id,
          kind: 'highlight',
          cfi: selection.cfi,
          href: selection.href,
          chapterLabel: selection.chapterLabel,
          text: selection.text,
          color,
          lineStyle,
          note: note.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        }
        await saveReadingAsset(highlight)
        pendingExistingHighlightRef.current = highlight
        if (renditionRef.current) {
          renderReadingHighlight(
            renditionRef.current,
            highlight,
            handleReadingHighlightOpen,
          )
        }
        setReadingAssets((current) => [highlight, ...current])
      }

      selectionDraftsRef.current.delete(selection.cfi)
      try {
        pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
      } catch {
        // The content document may have unloaded while the asset was saved.
      }
      pendingSelectionWindowRef.current = undefined
      if (pendingNoteRef.current === note) pendingNoteDirtyRef.current = false
      if (pendingLineStyleRef.current === lineStyle) {
        pendingLineStyleDirtyRef.current = false
      }

      const shouldClose =
        closeAfterSave || closePendingSelectionAfterSaveRef.current
      closePendingSelectionAfterSaveRef.current = false
      const hasNewerChanges =
        pendingNoteDirtyRef.current || pendingLineStyleDirtyRef.current
      if (shouldClose && hasNewerChanges) {
        closePendingSelectionAfterSaveRef.current = true
      } else if (shouldClose) {
        finishPendingSelection(selectionVersion)
      }
    } catch (saveError) {
      pendingColorRef.current = previousColor
      setPendingColor(previousColor)
      closePendingSelectionAfterSaveRef.current = false
      if (selectionVersion === pendingSelectionVersionRef.current) {
        setReadingAssetError(
          saveError instanceof Error ? saveError.message : '保存划线失败。',
        )
      }
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
      if (
        closePendingSelectionAfterSaveRef.current &&
        selectionVersion === pendingSelectionVersionRef.current
      ) {
        closePendingSelectionAfterSaveRef.current = false
        void handleSaveSelection(
          pendingColorRef.current ?? NOTE_HIGHLIGHT_COLOR,
          true,
        )
      }
    }
  }

  async function handlePendingLineStyleChange(
    lineStyle: ReadingHighlightStyle,
  ) {
    if (
      isSavingSelectionRef.current ||
      pendingLineStyleRef.current === lineStyle
    ) {
      return
    }

    const previousLineStyle = pendingLineStyleRef.current
    const existing = pendingExistingHighlightRef.current
    pendingLineStyleRef.current = lineStyle
    pendingLineStyleDirtyRef.current = true
    setPendingLineStyle(lineStyle)
    if (!existing) return

    pendingLineStyleDirtyRef.current = false
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    setReadingAssetError(undefined)

    try {
      const updated = await updateReadingHighlight(existing.id, { lineStyle })
      if (!updated) throw new Error('这条划线已经不存在。')
      pendingExistingHighlightRef.current = updated
      setReadingAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      if (renditionRef.current) {
        renditionRef.current.annotations.remove(existing.cfi, 'highlight')
        renderReadingHighlight(
          renditionRef.current,
          updated,
          handleReadingHighlightOpen,
        )
      }
    } catch (updateError) {
      pendingLineStyleRef.current = previousLineStyle
      setPendingLineStyle(previousLineStyle)
      setReadingAssetError(
        updateError instanceof Error
          ? updateError.message
          : '更新划线样式失败。',
      )
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
      if (pendingNoteDirtyRef.current) schedulePendingNoteSave()
    }
  }

  async function handleDeleteAsset(asset: ReadingAsset): Promise<boolean> {
    setReadingAssetError(undefined)
    try {
      await deleteReadingAsset(asset.id)
      if (asset.kind === 'highlight') {
        renditionRef.current?.annotations.remove(asset.cfi, 'highlight')
      }
      setReadingAssets((current) =>
        current.filter((currentAsset) => currentAsset.id !== asset.id),
      )
      setActiveAssetId((current) =>
        current === asset.id ? undefined : current,
      )
      return true
    } catch (deleteError) {
      setReadingAssetError(
        deleteError instanceof Error
          ? deleteError.message
          : '删除阅读记录失败。',
      )
      return false
    }
  }

  async function handleUpdateHighlight(
    highlight: ReadingHighlight,
    patch: Partial<Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note'>>,
  ): Promise<boolean> {
    setReadingAssetError(undefined)
    try {
      const updated = await updateReadingHighlight(highlight.id, patch)
      if (!updated) throw new Error('这条划线已经不存在。')
      setReadingAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      if (
        renditionRef.current &&
        (patch.color !== undefined ||
          patch.lineStyle !== undefined ||
          patch.note !== undefined)
      ) {
        renditionRef.current.annotations.remove(highlight.cfi, 'highlight')
        renderReadingHighlight(
          renditionRef.current,
          updated,
          handleReadingHighlightOpen,
        )
      }
      return true
    } catch (updateError) {
      setReadingAssetError(
        updateError instanceof Error ? updateError.message : '更新划线失败。',
      )
      return false
    }
  }

  function handleSelectAsset(asset: ReadingAsset) {
    dismissPendingSelection()
    setActiveAssetId(asset.id)
    void renditionRef.current?.display(asset.cfi)
    if (window.innerWidth < 780) setTocOpen(false)
  }

  function handleExportAssets(format: ReadingAssetExportFormat) {
    downloadReadingAssets(bookRecord, readingAssets, format)
  }

  const currentBookmark = readingAssets.find(
    (asset) =>
      asset.kind === 'bookmark' && asset.cfi === currentLocationRef.current,
  )

  async function handleToggleBookmark() {
    const cfi = currentLocationRef.current
    if (!cfi || isSavingBookmark) return
    setIsSavingBookmark(true)
    setReadingAssetError(undefined)
    try {
      if (currentBookmark) {
        await deleteReadingAsset(currentBookmark.id)
        setReadingAssets((current) =>
          current.filter((asset) => asset.id !== currentBookmark.id),
        )
      } else {
        const now = Date.now()
        const bookmark: ReadingAsset = {
          id: crypto.randomUUID(),
          bookId: bookRecord.id,
          kind: 'bookmark',
          cfi,
          href: currentHref,
          chapterLabel,
          createdAt: now,
          updatedAt: now,
        }
        await saveReadingAsset(bookmark)
        setReadingAssets((current) => [bookmark, ...current])
      }
    } catch (bookmarkError) {
      setReadingAssetError(
        bookmarkError instanceof Error
          ? bookmarkError.message
          : '保存书签失败。',
      )
    } finally {
      setIsSavingBookmark(false)
    }
  }

  function handleNavigationToggle(panel: NavigationPanel) {
    dismissPendingSelection()
    setSettingsOpen(false)
    if (tocOpen && navigationPanel === panel) {
      setTocOpen(false)
      return
    }
    setNavigationPanel(panel)
    setTocOpen(true)
  }

  function displayChapter(href: string) {
    dismissPendingSelection()
    setChapterProgress(0)
    setAtChapterStart(false)
    setAtChapterEnd(false)
    void renditionRef.current?.display(href)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function displaySearchResult(result: BookSearchResult) {
    dismissPendingSelection()
    setChapterProgress(0)
    setAtChapterStart(false)
    setAtChapterEnd(false)
    void renditionRef.current?.display(result.cfi)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function handleReaderFlowChange(flow: ReaderFlow) {
    dismissPendingSelection()
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
    dismissPendingSelection()
    if (atChapterEnd && nextChapter) {
      displayChapter(nextChapter.href)
      return
    }
    void renditionRef.current?.next()
  }

  function handleBackward() {
    dismissPendingSelection()
    void renditionRef.current?.prev()
  }

  paginationNavigationRef.current = (direction) => {
    if (direction === 'previous') {
      handleBackward()
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
                onShowAssets={() => setNavigationPanel('assets')}
                onSearch={() => setNavigationPanel('search')}
                onSelect={displayChapter}
              />
            ) : navigationPanel === 'search' ? (
              <BookSearchPanel
                bookId={bookRecord.id}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onSearch={searchBookContent}
                onSelect={displaySearchResult}
                onShowAssets={() => setNavigationPanel('assets')}
                onShowToc={() => setNavigationPanel('toc')}
              />
            ) : (
              <ReadingAssetsPanel
                book={bookRecord}
                assets={readingAssets}
                activeAssetId={activeAssetId}
                activeAssetFocusVersion={activeAssetFocusVersion}
                errorMessage={readingAssetError}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onDelete={handleDeleteAsset}
                onExport={handleExportAssets}
                onSelect={handleSelectAsset}
                onShowSearch={() => setNavigationPanel('search')}
                onShowToc={() => setNavigationPanel('toc')}
                onUpdateHighlight={handleUpdateHighlight}
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
              <button
                className="reader-tool-button"
                type="button"
                aria-pressed={tocOpen && navigationPanel === 'assets'}
                onClick={() => handleNavigationToggle('assets')}
              >
                <NotebookPen aria-hidden="true" size={18} strokeWidth={1.7} />
                <span>书摘</span>
              </button>
              <button
                className="reader-tool-button reader-bookmark-button"
                type="button"
                aria-label={currentBookmark ? '移除当前页书签' : '为当前页添加书签'}
                aria-pressed={Boolean(currentBookmark)}
                disabled={!currentLocationRef.current || isSavingBookmark}
                onClick={() => void handleToggleBookmark()}
              >
                <Bookmark
                  aria-hidden="true"
                  size={18}
                  strokeWidth={1.7}
                  fill={currentBookmark ? 'currentColor' : 'none'}
                />
                <span>{currentBookmark ? '已加书签' : '当前页书签'}</span>
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
                {pendingSelection && !isOpening ? (
                  <aside
                    className="selection-editor"
                    role="dialog"
                    aria-label="为选中文字添加划线和批注"
                  >
                    <div className="selection-editor-heading">
                      <div>
                        <span>划线与批注</span>
                        <strong>{pendingSelection.chapterLabel || '当前章节'}</strong>
                      </div>
                      {pendingExistingHighlightRef.current ? (
                        <button
                          className="selection-editor-delete"
                          type="button"
                          aria-label="删除划线和批注"
                          disabled={isSavingSelection}
                          onClick={() => void handleDeletePendingHighlight()}
                        >
                          <Trash2
                            aria-hidden="true"
                            size={15}
                            strokeWidth={1.65}
                          />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label="关闭划线与批注"
                        onClick={dismissPendingSelection}
                      >
                        <X aria-hidden="true" size={16} strokeWidth={1.7} />
                      </button>
                    </div>
                    <blockquote>{pendingSelection.text}</blockquote>
                    <div
                      className="selection-editor-colors"
                      aria-label="划线颜色"
                    >
                      {QUICK_HIGHLIGHT_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          className={`highlight-color is-${color.value}`}
                          type="button"
                          aria-label={color.label}
                          aria-pressed={pendingColor === color.value}
                          disabled={isSavingSelection}
                          onClick={() =>
                            void handleSaveSelection(color.value)
                          }
                        />
                      ))}
                    </div>
                    <div
                      className="highlight-style-options"
                      aria-label="划线样式"
                    >
                      {READING_HIGHLIGHT_STYLE_OPTIONS.map((style) => (
                        <button
                          key={style.value}
                          className="highlight-style-option"
                          type="button"
                          aria-label={style.label}
                          aria-pressed={pendingLineStyle === style.value}
                          disabled={isSavingSelection}
                          onClick={() =>
                            void handlePendingLineStyleChange(style.value)
                          }
                        >
                          <ReadingHighlightStyleIcon style={style.value} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={pendingNote}
                      maxLength={2000}
                      rows={3}
                      placeholder="写下批注，离开后自动保存"
                      onChange={(event) => {
                        pendingNoteRef.current = event.target.value
                        pendingNoteDirtyRef.current = true
                        setPendingNote(event.target.value)
                        schedulePendingNoteSave()
                      }}
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget
                        if (
                          nextTarget instanceof Element &&
                          nextTarget.closest('.selection-editor')
                        ) {
                          return
                        }
                        dismissPendingSelection()
                      }}
                    />
                    {readingAssetError ? (
                      <p className="selection-editor-error" role="alert">
                        {readingAssetError}
                      </p>
                    ) : null}
                  </aside>
                ) : null}
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
                onClick={handleBackward}
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
