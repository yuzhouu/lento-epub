import type { BookReadingStatus, BookRecord } from '../types/book'

export const BOOK_READING_STATUSES: readonly BookReadingStatus[] = [
  'unread',
  'reading',
  'finished',
]

export const BOOK_READING_STATUS_KEYS: Record<BookReadingStatus, string> = {
  unread: 'library.status.unread',
  reading: 'library.status.reading',
  finished: 'library.status.finished',
}

export const MAX_BOOK_TAGS = 8
export const MAX_BOOK_TAG_LENGTH = 20

export function getBookReadingStatus(book: BookRecord): BookReadingStatus {
  if (book.readingStatus) return book.readingStatus
  if (book.progress >= 0.995) return 'finished'
  if (book.lastOpenedAt || book.progress > 0) return 'reading'
  return 'unread'
}

export function normalizeBookTags(tags: readonly string[]): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const value of tags) {
    const tag = value
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, MAX_BOOK_TAG_LENGTH)
    const key = tag.toLocaleLowerCase('zh-CN')
    if (!tag || seen.has(key)) continue
    seen.add(key)
    normalized.push(tag)
    if (normalized.length === MAX_BOOK_TAGS) break
  }

  return normalized
}
