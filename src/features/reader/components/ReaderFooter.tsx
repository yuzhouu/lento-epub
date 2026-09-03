import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

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
            ? t('reader.footer.progressAndPages')
            : offerPreviousChapter || offerNextChapter
              ? t('reader.footer.progressAndChapters')
              : t('reader.footer.progress')
        }
      >
        {flow === 'paginated' ? (
          <button type="button" onClick={onBackward}>
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
            {t('reader.footer.previousPage')}
          </button>
        ) : offerPreviousChapter && previousChapter ? (
          <button
            className="chapter-previous-button"
            type="button"
            aria-label={t('reader.footer.enterPrevious', { chapter: previousChapter.label })}
            onClick={() => onDisplayChapter(previousChapter.href)}
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} />
            {t('reader.footer.previousChapter')}
            <span className="chapter-boundary-label">
              · {previousChapter.label}
            </span>
          </button>
        ) : null}
        <span
          className="reader-chapter-progress"
          aria-label={t('reader.footer.chapterProgress', { percent: chapterPercent })}
        >
          {chapterPercent}%
        </span>
        {flow === 'paginated' ? (
          <button
            className={offerNextChapter ? 'chapter-next-button' : ''}
            type="button"
            aria-label={
              atChapterEnd && nextChapter
                ? t('reader.footer.enterNext', { chapter: nextChapter.label })
                : t('reader.footer.nextPage')
            }
            onClick={onForward}
          >
            {atChapterEnd && nextChapter ? (
              <>
                {t('reader.footer.nextChapter')}
                <span className="chapter-boundary-label">
                  · {nextChapter.label}
                </span>
              </>
            ) : (
              t('reader.footer.nextPage')
            )}
            <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </button>
        ) : offerNextChapter && nextChapter ? (
          <button
            className="chapter-next-button"
            type="button"
            aria-label={t('reader.footer.enterNext', { chapter: nextChapter.label })}
            onClick={() => onDisplayChapter(nextChapter.href)}
          >
            {t('reader.footer.nextChapter')}
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
