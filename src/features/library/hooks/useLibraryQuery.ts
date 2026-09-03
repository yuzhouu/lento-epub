import { useDeferredValue, useMemo, useState } from 'react'
import { BOOK_READING_STATUSES } from '../../../lib/book-organization'
import type { BookRecord } from '../../../types/book'
import {
  getLibraryTags,
  queryLibraryBooks,
  type LibrarySort,
  type ReadingStatusFilter,
} from '../model/library-query'

export type { LibrarySort, ReadingStatusFilter } from '../model/library-query'

export const LIBRARY_SORT_KEYS: Record<LibrarySort, string> = {
  recent: 'library.toolbar.sortRecent',
  added: 'library.toolbar.sortAdded',
  progress: 'library.toolbar.sortProgress',
}

export const READING_STATUS_FILTERS: readonly ReadingStatusFilter[] = [
  'all',
  ...BOOK_READING_STATUSES,
]

export function useLibraryQuery(books: BookRecord[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<LibrarySort>('recent')
  const [statusFilter, setStatusFilter] =
    useState<ReadingStatusFilter>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [activeTag, setActiveTag] = useState<string>()
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const allTags = useMemo(() => getLibraryTags(books), [books])

  const effectiveActiveTag =
    activeTag && allTags.includes(activeTag) ? activeTag : undefined
  const visibleBooks = useMemo(
    () =>
      queryLibraryBooks(books, {
        searchQuery: deferredSearchQuery,
        sortBy,
        statusFilter,
        favoriteOnly,
        activeTag: effectiveActiveTag,
      }),
    [
      books,
      deferredSearchQuery,
      effectiveActiveTag,
      favoriteOnly,
      sortBy,
      statusFilter,
    ],
  )

  const hasActiveFilters = Boolean(
    searchQuery ||
      statusFilter !== 'all' ||
      favoriteOnly ||
      effectiveActiveTag,
  )

  function clearFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setFavoriteOnly(false)
    setActiveTag(undefined)
  }

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter,
    favoriteOnly,
    setFavoriteOnly,
    activeTag: effectiveActiveTag,
    setActiveTag,
    allTags,
    visibleBooks,
    isSearchPending: searchQuery !== deferredSearchQuery,
    hasActiveFilters,
    clearFilters,
  }
}
