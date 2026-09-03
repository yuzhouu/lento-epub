import { Search, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BOOK_READING_STATUS_KEYS } from '../../../lib/book-organization'
import {
  LIBRARY_SORT_KEYS,
  READING_STATUS_FILTERS,
  type LibrarySort,
  type ReadingStatusFilter,
} from '../hooks/useLibraryQuery'

interface LibraryToolbarProps {
  searchQuery: string
  sortBy: LibrarySort
  statusFilter: ReadingStatusFilter
  favoriteOnly: boolean
  activeTag?: string
  allTags: string[]
  hasActiveFilters: boolean
  onSearchQueryChange: (query: string) => void
  onSortChange: (sort: LibrarySort) => void
  onStatusFilterChange: (status: ReadingStatusFilter) => void
  onFavoriteToggle: () => void
  onTagToggle: (tag: string) => void
  onClear: () => void
}

export function LibraryToolbar({
  searchQuery,
  sortBy,
  statusFilter,
  favoriteOnly,
  activeTag,
  allTags,
  hasActiveFilters,
  onSearchQueryChange,
  onSortChange,
  onStatusFilterChange,
  onFavoriteToggle,
  onTagToggle,
  onClear,
}: LibraryToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="library-management" aria-label={t('library.toolbar.label')}>
      <div className="library-management-primary">
        <label className="library-search-field">
          <Search aria-hidden="true" size={17} strokeWidth={1.7} />
          <span className="visually-hidden">{t('library.toolbar.search')}</span>
          <input
            type="search"
            value={searchQuery}
            placeholder={t('library.toolbar.search')}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
        <label className="library-sort-field">
          <span>{t('library.toolbar.sort')}</span>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as LibrarySort)}
          >
            {Object.entries(LIBRARY_SORT_KEYS).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="library-filter-row">
        <div
          className="library-status-filters"
          role="group"
          aria-label={t('library.toolbar.filterStatus')}
        >
          {READING_STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'is-active' : ''}
              aria-pressed={statusFilter === status}
              onClick={() => onStatusFilterChange(status)}
            >
              {status === 'all'
                ? t('common.all')
                : t(BOOK_READING_STATUS_KEYS[status])}
            </button>
          ))}
        </div>
        <button
          className={`library-favorite-filter${
            favoriteOnly ? ' is-active' : ''
          }`}
          type="button"
          aria-pressed={favoriteOnly}
          onClick={onFavoriteToggle}
        >
          <Star
            aria-hidden="true"
            size={14}
            strokeWidth={1.7}
            fill={favoriteOnly ? 'currentColor' : 'none'}
          />
          {t('common.favorite')}
        </button>
        {hasActiveFilters ? (
          <button className="library-clear-filters" type="button" onClick={onClear}>
            {t('library.clearFilters')}
          </button>
        ) : null}
      </div>

      {allTags.length ? (
        <div className="library-tag-filters" aria-label={t('library.toolbar.filterTags')}>
          <span>{t('library.toolbar.tags')}</span>
          <div>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={activeTag === tag ? 'is-active' : ''}
                aria-pressed={activeTag === tag}
                onClick={() => onTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
