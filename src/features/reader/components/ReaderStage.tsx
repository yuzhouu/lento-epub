import type { ReactNode, RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReaderFlow } from '../model/reader-preferences'

interface ReaderStageProps {
  flow: ReaderFlow
  clickPagination: boolean
  isOpening: boolean
  openingMessage: string
  error?: string
  viewerRef: RefObject<HTMLDivElement | null>
  selectionEditor?: ReactNode
  onBack: () => void
  onPageTurn: (direction: 'previous' | 'next') => void
}

export function ReaderStage({
  flow,
  clickPagination,
  isOpening,
  openingMessage,
  error,
  viewerRef,
  selectionEditor,
  onBack,
  onPageTurn,
}: ReaderStageProps) {
  return (
    <div
      className={
        flow === 'paginated' ? 'reader-stage' : 'reader-stage is-scroll-flow'
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
          {!isOpening ? selectionEditor : null}
          {flow === 'paginated' && clickPagination && !isOpening ? (
            <>
              <button
                className="page-turn-zone is-previous"
                type="button"
                aria-label="点击左侧区域翻到上一页"
                onClick={() => onPageTurn('previous')}
              >
                <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.5} />
              </button>
              <button
                className="page-turn-zone is-next"
                type="button"
                aria-label="点击右侧区域翻到下一页"
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
              <span>较大的书籍可能需要一点时间</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
