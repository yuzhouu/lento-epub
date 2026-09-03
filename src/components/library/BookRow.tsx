import { BookOpen, Settings2, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getCurrentLanguage } from '../../i18n'
import { formatBytes } from '../../lib/format-bytes'
import {
  BOOK_READING_STATUS_KEYS,
  getBookReadingStatus,
} from '../../lib/book-organization'
import type { BookRecord } from '../../types/book'

interface BookRowProps {
  book: BookRecord
  isManaged: boolean
  onOpen: (id: string) => void
  onManage: (id: string) => void
  onRequestDelete: (book: BookRecord) => void
}

function formatDate(timestamp: number | undefined, t: TFunction): string {
  if (!timestamp) return t('library.book.neverStarted')
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function BookRow({
  book,
  isManaged,
  onOpen,
  onManage,
  onRequestDelete,
}: BookRowProps) {
  const { t } = useTranslation()
  const progress = Math.round(book.progress * 100)
  const readingStatus = getBookReadingStatus(book)
  const tags = book.tags ?? []

  return (
    <article className={`book-row${isManaged ? ' is-managed' : ''}`}>
      <button
        className="book-open-button"
        type="button"
        aria-label={t('library.book.readLabel', { title: book.title })}
        onClick={() => onOpen(book.id)}
      >
        <div className="book-cover" aria-hidden="true">
          {book.coverDataUrl ? (
            <img src={book.coverDataUrl} alt="" />
          ) : (
            <div className="book-cover-fallback">
              <BookOpen size={24} strokeWidth={1.4} />
              <span>{book.title}</span>
            </div>
          )}
        </div>
        <div className="book-copy">
          <h2>{book.title}</h2>
          <p className="book-author">{book.author}</p>
          <p className="book-last-read">
            {book.chapterLabel
              ? t('library.book.lastRead', { chapter: book.chapterLabel })
              : t('library.book.neverRead')}
          </p>
          <time
            dateTime={
              book.lastOpenedAt
                ? new Date(book.lastOpenedAt).toISOString()
                : undefined
            }
          >
            {formatDate(book.lastOpenedAt, t)}
          </time>
          <div
            className="book-tag-preview"
            aria-label={tags.length ? t('library.book.tagsLabel') : undefined}
          >
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </button>
      <div className="book-row-aside">
        <div className="book-row-state">
          <span className={`book-status-badge status-${readingStatus}`}>
            {t(BOOK_READING_STATUS_KEYS[readingStatus])}
          </span>
          {book.isFavorite ? (
            <span className="book-favorite-indicator" title={t('library.book.favorited')}>
              <Star
                aria-label={t('library.book.favorited')}
                size={14}
                strokeWidth={1.7}
                fill="currentColor"
              />
            </span>
          ) : null}
        </div>
        <button
          className={`book-manage-button${isManaged ? ' is-active' : ''}`}
          type="button"
          aria-label={t('library.book.manageLabel', { title: book.title })}
          aria-controls="book-details-sidebar"
          aria-expanded={isManaged}
          onClick={() => onManage(book.id)}
        >
          <Settings2 aria-hidden="true" size={14} strokeWidth={1.7} />
          <span>{t('common.manage')}</span>
        </button>
        <dl className="book-stats">
          <div>
            <dt>{t('library.book.progress')}</dt>
            <dd>{progress}%</dd>
          </div>
          <div>
            <dt>{t('library.book.fileSize')}</dt>
            <dd>{formatBytes(book.fileSize)}</dd>
          </div>
        </dl>
        <button
          className="book-delete-button"
          type="button"
          aria-label={t('library.book.deleteLabel', { title: book.title })}
          title={t('library.book.deleteTitle')}
          onClick={() => onRequestDelete(book)}
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={1.6} />
          <span>{t('common.delete')}</span>
        </button>
      </div>
    </article>
  )
}
