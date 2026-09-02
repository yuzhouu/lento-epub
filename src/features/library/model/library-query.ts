import { getBookReadingStatus } from '../../../lib/book-organization'
import type { BookReadingStatus } from '../../../types/book'
import type { BookRecord } from '../../../types/book'

export type LibrarySort = 'recent' | 'added' | 'progress'
export type ReadingStatusFilter = 'all' | BookReadingStatus

export interface LibraryQuery {
  searchQuery: string
  sortBy: LibrarySort
  statusFilter: ReadingStatusFilter
  favoriteOnly: boolean
  activeTag?: string
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

export function getLibraryTags(books: readonly BookRecord[]): string[] {
  const tagsByKey = new Map<string, string>()
  for (const book of books) {
    for (const tag of book.tags ?? []) {
      const key = normalizeSearchValue(tag)
      if (key && !tagsByKey.has(key)) tagsByKey.set(key, tag)
    }
  }
  return [...tagsByKey.values()].sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  )
}

export function queryLibraryBooks(
  books: readonly BookRecord[],
  query: LibraryQuery,
): BookRecord[] {
  const queryTokens = normalizeSearchValue(query.searchQuery)
    .split(/\s+/)
    .filter(Boolean)
  const activeTagKey = query.activeTag
    ? normalizeSearchValue(query.activeTag)
    : undefined
  const filtered = books.filter((book) => {
    if (
      queryTokens.length > 0 &&
      !queryTokens.every((token) =>
        normalizeSearchValue(`${book.title} ${book.author}`).includes(token),
      )
    ) {
      return false
    }
    if (
      query.statusFilter !== 'all' &&
      getBookReadingStatus(book) !== query.statusFilter
    ) {
      return false
    }
    if (query.favoriteOnly && !book.isFavorite) return false
    if (
      activeTagKey &&
      !(book.tags ?? []).some(
        (tag) => normalizeSearchValue(tag) === activeTagKey,
      )
    ) {
      return false
    }
    return true
  })

  return filtered.sort((left, right) => {
    if (query.sortBy === 'added') return right.addedAt - left.addedAt
    if (query.sortBy === 'progress') {
      return right.progress - left.progress || right.addedAt - left.addedAt
    }
    return (
      (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0) ||
      right.addedAt - left.addedAt
    )
  })
}
