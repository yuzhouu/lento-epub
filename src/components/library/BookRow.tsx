import type { KeyboardEvent } from 'react'
import { BookOpen } from 'lucide-react'
import type { BookRecord } from '../../types/book'

interface BookRowProps {
  book: BookRecord
  onOpen: (id: string) => void
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

export function BookRow({ book, onOpen }: BookRowProps) {
  const progress = Math.round(book.progress * 100)

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(book.id)
    }
  }

  return (
    <article
      className="book-row"
      role="button"
      tabIndex={0}
      aria-label={`阅读《${book.title}》`}
      onClick={() => onOpen(book.id)}
      onKeyDown={handleKeyDown}
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
          {book.chapterLabel ? `上次阅读 · ${book.chapterLabel}` : '尚未开始阅读'}
        </p>
        <time dateTime={book.lastOpenedAt?.toString()}>
          {formatDate(book.lastOpenedAt)}
        </time>
      </div>
      <div className="book-progress" aria-label={`阅读进度 ${progress}%`}>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}%</span>
      </div>
    </article>
  )
}
