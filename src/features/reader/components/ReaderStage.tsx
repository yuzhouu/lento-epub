import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReaderFlow } from '../model/reader-preferences'

interface ReaderStageProps {
  flow: ReaderFlow
  clickPagination: boolean
  isOpening: boolean
  openingMessage: string
  error?: string
  viewerRef: RefObject<HTMLDivElement | null>
  chapterProgress: number
  chapterScrollSize: number
  chapterViewportSize: number
  selectionEditor?: ReactNode
  onBack: () => void
  onPageTurn: (direction: 'previous' | 'next') => void
  onChapterScroll: (progress: number) => void
}

interface ChapterScrollbarProps {
  progress: number
  scrollSize: number
  viewportSize: number
  onScroll: (progress: number) => void
}

function ChapterScrollbar({
  progress,
  scrollSize,
  viewportSize,
  onScroll,
}: ChapterScrollbarProps) {
  const { t } = useTranslation()
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const synchronizedScrollTopRef = useRef<number | undefined>(undefined)
  const hasOverflow = scrollSize > viewportSize + 1

  useEffect(() => {
    const scrollbar = scrollbarRef.current
    if (!scrollbar || !hasOverflow) return
    const scrollableDistance = scrollbar.scrollHeight - scrollbar.clientHeight
    const nextScrollTop = progress * scrollableDistance
    if (Math.abs(scrollbar.scrollTop - nextScrollTop) <= 1) {
      synchronizedScrollTopRef.current = undefined
      return
    }
    synchronizedScrollTopRef.current = nextScrollTop
    scrollbar.scrollTop = nextScrollTop
  }, [hasOverflow, progress, scrollSize, viewportSize])

  if (!hasOverflow) return null

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scrollbar = event.currentTarget
    const synchronizedScrollTop = synchronizedScrollTopRef.current
    if (
      synchronizedScrollTop !== undefined &&
      Math.abs(scrollbar.scrollTop - synchronizedScrollTop) <= 1
    ) {
      synchronizedScrollTopRef.current = undefined
      return
    }
    synchronizedScrollTopRef.current = undefined
    const scrollableDistance = scrollbar.scrollHeight - scrollbar.clientHeight
    onScroll(
      scrollableDistance > 0 ? scrollbar.scrollTop / scrollableDistance : 0,
    )
  }

  return (
    <div
      ref={scrollbarRef}
      className="chapter-scrollbar"
      role="scrollbar"
      tabIndex={0}
      aria-controls="reader-epub-viewer"
      aria-label={t('reader.stage.scrollPosition')}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onScroll={handleScroll}
    >
      <div
        className="chapter-scrollbar-spacer"
        style={{ height: `${Math.ceil(scrollSize)}px` }}
        aria-hidden="true"
      />
    </div>
  )
}

export function ReaderStage({
  flow,
  clickPagination,
  isOpening,
  openingMessage,
  error,
  viewerRef,
  chapterProgress,
  chapterScrollSize,
  chapterViewportSize,
  selectionEditor,
  onBack,
  onPageTurn,
  onChapterScroll,
}: ReaderStageProps) {
  const { t } = useTranslation()
  const stageClassName = [
    'reader-stage',
    flow !== 'paginated' ? 'is-scroll-flow' : '',
    flow === 'chapter' ? 'is-chapter-flow' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={stageClassName}
      aria-busy={isOpening}
    >
      {error ? (
        <div className="reader-error" role="alert">
          <h1>{t('reader.stage.openFailed')}</h1>
          <p>{error}</p>
          <button type="button" onClick={onBack}>
            {t('reader.stage.back')}
          </button>
        </div>
      ) : (
        <>
          <div
            ref={viewerRef}
            id="reader-epub-viewer"
            className="epub-viewer"
          />
          {flow === 'chapter' ? (
            <ChapterScrollbar
              progress={chapterProgress}
              scrollSize={chapterScrollSize}
              viewportSize={chapterViewportSize}
              onScroll={onChapterScroll}
            />
          ) : null}
          {!isOpening ? selectionEditor : null}
          {flow === 'paginated' && clickPagination && !isOpening ? (
            <>
              <button
                className="page-turn-zone is-previous"
                type="button"
                aria-label={t('reader.stage.previousZone')}
                onClick={() => onPageTurn('previous')}
              >
                <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.5} />
              </button>
              <button
                className="page-turn-zone is-next"
                type="button"
                aria-label={t('reader.stage.nextZone')}
                onClick={() => onPageTurn('next')}
              >
                <ChevronRight aria-hidden="true" size={22} strokeWidth={1.5} />
              </button>
            </>
          ) : null}
          {isOpening ? (
            <div className="reader-loading" role="status" aria-live="polite">
              <span className="reader-loading-spinner" aria-hidden="true" />
              <strong>{openingMessage}</strong>
              <span>{t('reader.stage.largeBook')}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
