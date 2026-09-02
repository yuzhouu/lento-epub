import { Search, Star } from 'lucide-react'
import { BOOK_READING_STATUS_LABELS } from '../../../lib/book-organization'
import {
  LIBRARY_SORT_LABELS,
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
  return (
    <div className="library-management" aria-label="管理书架">
      <div className="library-management-primary">
        <label className="library-search-field">
          <Search aria-hidden="true" size={17} strokeWidth={1.7} />
          <span className="visually-hidden">搜索书名或作者</span>
          <input
            type="search"
            value={searchQuery}
            placeholder="搜索书名或作者"
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
        <label className="library-sort-field">
          <span>排序</span>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as LibrarySort)}
          >
            {Object.entries(LIBRARY_SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="library-filter-row">
        <div
          className="library-status-filters"
          role="group"
          aria-label="按阅读状态筛选"
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
                ? '全部'
                : BOOK_READING_STATUS_LABELS[status]}
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
          收藏
        </button>
        {hasActiveFilters ? (
          <button className="library-clear-filters" type="button" onClick={onClear}>
            清除筛选
          </button>
        ) : null}
      </div>

      {allTags.length ? (
        <div className="library-tag-filters" aria-label="按标签筛选">
          <span>标签</span>
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
