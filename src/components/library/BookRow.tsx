import { BookOpen, Settings2, Star, Trash2 } from 'lucide-react'
import { formatBytes } from '../../lib/format-bytes'
import {
  BOOK_READING_STATUS_LABELS,
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

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return '尚未开始'
  return new Intl.DateTimeFormat('zh-CN', {
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
  const progress = Math.round(book.progress * 100)
  const readingStatus = getBookReadingStatus(book)
  const tags = book.tags ?? []

  return (
    <article className={`book-row${isManaged ? ' is-managed' : ''}`}>
      <button
        className="book-open-button"
        type="button"
        aria-label={`阅读《${book.title}》`}
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
              ? `上次阅读 · ${book.chapterLabel}`
              : '尚未开始阅读'}
          </p>
          <time
            dateTime={
              book.lastOpenedAt
                ? new Date(book.lastOpenedAt).toISOString()
                : undefined
            }
          >
            {formatDate(book.lastOpenedAt)}
          </time>
          <div
            className="book-tag-preview"
            aria-label={tags.length ? '书籍标签' : undefined}
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
            {BOOK_READING_STATUS_LABELS[readingStatus]}
          </span>
          {book.isFavorite ? (
            <span className="book-favorite-indicator" title="已收藏">
              <Star
                aria-label="已收藏"
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
          aria-label={`管理《${book.title}》`}
          aria-controls="book-details-sidebar"
          aria-expanded={isManaged}
          onClick={() => onManage(book.id)}
        >
          <Settings2 aria-hidden="true" size={14} strokeWidth={1.7} />
          <span>管理</span>
        </button>
        <dl className="book-stats">
          <div>
            <dt>阅读进度</dt>
            <dd>{progress}%</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{formatBytes(book.fileSize)}</dd>
          </div>
        </dl>
        <button
          className="book-delete-button"
          type="button"
          aria-label={`删除《${book.title}》`}
          title="删除书籍"
          onClick={() => onRequestDelete(book)}
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={1.6} />
          <span>删除</span>
        </button>
      </div>
    </article>
  )
}
