import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TocItem } from '../../../types/book'
import type { ReaderFlow } from '../model/reader-preferences'

interface ReaderFooterProps {
  flow: ReaderFlow
  chapterPercent: number
  atChapterEnd: boolean
  previousChapter?: TocItem
  nextChapter?: TocItem
  offerPreviousChapter: boolean
  offerNextChapter: boolean
  onBackward: () => void
  onForward: () => void
  onDisplayChapter: (href: string) => void
}

export function ReaderFooter({
  flow,
  chapterPercent,
  atChapterEnd,
  previousChapter,
  nextChapter,
  offerPreviousChapter,
  offerNextChapter,
  onBackward,
  onForward,
  onDisplayChapter,
}: ReaderFooterProps) {
  return (
    <>
      <footer
        className={`reader-footer${
          flow === 'paginated' ? ' is-paginated' : ''
        }${offerPreviousChapter ? ' is-chapter-start' : ''}${
          offerNextChapter ? ' is-chapter-end' : ''
        }`}
        aria-label={
          flow === 'paginated'
            ? '阅读进度与翻页'
            : offerPreviousChapter || offerNextChapter
              ? '阅读进度与章节导航'
              : '阅读进度'
        }
      >
        {flow === 'paginated' ? (
          <button type="button" onClick={onBackward}>
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
            上一页
          </button>
        ) : offerPreviousChapter && previousChapter ? (
          <button
            className="chapter-previous-button"
            type="button"
            aria-label={`进入上一章：${previousChapter.label}`}
            onClick={() => onDisplayChapter(previousChapter.href)}
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
        {flow === 'paginated' ? (
          <button
            className={offerNextChapter ? 'chapter-next-button' : ''}
            type="button"
            aria-label={
              atChapterEnd && nextChapter
                ? `进入下一章：${nextChapter.label}`
                : '下一页'
            }
            onClick={onForward}
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
        ) : offerNextChapter && nextChapter ? (
          <button
            className="chapter-next-button"
            type="button"
            aria-label={`进入下一章：${nextChapter.label}`}
            onClick={() => onDisplayChapter(nextChapter.href)}
          >
            下一章
            <span className="chapter-boundary-label">· {nextChapter.label}</span>
            <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        ) : null}
      </footer>
      <div className="reader-progress" aria-hidden="true">
        <span style={{ width: `${chapterPercent}%` }} />
      </div>
    </>
  )
}
