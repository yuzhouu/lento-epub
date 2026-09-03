import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  ArrowLeft,
  Clock3,
  List,
  NotebookPen,
  PanelLeftClose,
  Search,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface BookSearchResult {
  cfi: string
  chapter: string
  excerpt: string
  href: string
}

interface SearchProgress {
  completed: number
  total: number
}

interface BookSearchPanelProps {
  bookId: string
  onBack: () => void
  onClose: () => void
  onSearch: (
    query: string,
    signal: AbortSignal,
    onProgress: (progress: SearchProgress) => void,
  ) => Promise<BookSearchResult[]>
  onSelect: (result: BookSearchResult) => void
  onShowAssets: () => void
  onShowToc: () => void
}

const RECENT_SEARCH_STORAGE_PREFIX = 'lento:recent-book-searches:v1:'
const MAX_RECENT_SEARCHES = 8
const MAX_QUERY_LENGTH = 100

function getRecentSearches(bookId: string): string[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(`${RECENT_SEARCH_STORAGE_PREFIX}${bookId}`) ?? '[]',
    )
    if (!Array.isArray(stored)) return []
    return stored
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES)
  } catch {
    return []
  }
}

function saveRecentSearch(bookId: string, query: string): string[] {
  const recent = [
    query,
    ...getRecentSearches(bookId).filter(
      (item) => item.toLocaleLowerCase() !== query.toLocaleLowerCase(),
    ),
  ].slice(0, MAX_RECENT_SEARCHES)

  try {
    localStorage.setItem(
      `${RECENT_SEARCH_STORAGE_PREFIX}${bookId}`,
      JSON.stringify(recent),
    )
  } catch {
    // Search remains available when local storage is unavailable.
  }
  return recent
}

function clearRecentSearches(bookId: string) {
  try {
    localStorage.removeItem(`${RECENT_SEARCH_STORAGE_PREFIX}${bookId}`)
  } catch {
    // Search remains available when local storage is unavailable.
  }
}

function normalizeExcerpt(excerpt: string): string {
  return excerpt.replace(/\s+/g, ' ').trim()
}

function HighlightedExcerpt({ text, query }: { text: string; query: string }) {
  const excerpt = normalizeExcerpt(text)
  const normalizedQuery = query.toLocaleLowerCase()
  const normalizedExcerpt = excerpt.toLocaleLowerCase()
  const parts: Array<{ text: string; highlighted: boolean }> = []
  let offset = 0

  while (offset < excerpt.length) {
    const matchIndex = normalizedExcerpt.indexOf(normalizedQuery, offset)
    if (matchIndex < 0) {
      parts.push({ text: excerpt.slice(offset), highlighted: false })
      break
    }
    if (matchIndex > offset) {
      parts.push({
        text: excerpt.slice(offset, matchIndex),
        highlighted: false,
      })
    }
    parts.push({
      text: excerpt.slice(matchIndex, matchIndex + query.length),
      highlighted: true,
    })
    offset = matchIndex + query.length
  }

  return (
    <>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={`${index}-${part.text}`}>{part.text}</mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

export function BookSearchPanel({
  bookId,
  onBack,
  onClose,
  onSearch,
  onSelect,
  onShowAssets,
  onShowToc,
}: BookSearchPanelProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const searchControllerRef = useRef<AbortController | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState(() =>
    getRecentSearches(bookId),
  )
  const [status, setStatus] = useState<
    'idle' | 'searching' | 'complete' | 'error'
  >('idle')
  const [progress, setProgress] = useState<SearchProgress>({
    completed: 0,
    total: 0,
  })
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
    return () => searchControllerRef.current?.abort()
  }, [])

  async function runSearch(rawQuery: string) {
    const nextQuery = rawQuery.trim().slice(0, MAX_QUERY_LENGTH)
    if (!nextQuery) {
      inputRef.current?.focus()
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setQuery(nextQuery)
    setSearchedQuery(nextQuery)
    setResults([])
    setErrorMessage('')
    setProgress({ completed: 0, total: 0 })
    setStatus('searching')
    setRecentSearches(saveRecentSearch(bookId, nextQuery))

    try {
      const nextResults = await onSearch(
        nextQuery,
        controller.signal,
        (nextProgress) => {
          startTransition(() => setProgress(nextProgress))
        },
      )
      if (controller.signal.aborted) return
      startTransition(() => {
        setResults(nextResults)
        setStatus('complete')
      })
    } catch (error) {
      if (controller.signal.aborted) return
      setErrorMessage(
        error instanceof Error ? error.message : t('reader.search.unavailable'),
      )
      setStatus('error')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runSearch(query)
  }

  function handleClearInput() {
    searchControllerRef.current?.abort()
    setQuery('')
    setSearchedQuery('')
    setResults([])
    setStatus('idle')
    setProgress({ completed: 0, total: 0 })
    inputRef.current?.focus()
  }

  return (
    <aside className="toc-panel book-search-panel" aria-label={t('reader.search.label')}>
      <div className="toc-header">
        <strong>{t('common.brandShort')}</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">{t('reader.search.close')}</span>
        </button>
      </div>

      <div className="navigation-tabs has-three" aria-label={t('reader.navigation')}>
        <button type="button" onClick={onShowToc}>
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.toc')}
        </button>
        <button className="is-active" type="button" aria-current="page">
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.search')}
        </button>
        <button type="button" onClick={onShowAssets}>
          <NotebookPen aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.excerpts')}
        </button>
      </div>

      <div className="book-search-content">
        <form className="book-search-form" role="search" onSubmit={handleSubmit}>
          <div className="book-search-field">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              maxLength={MAX_QUERY_LENGTH}
              placeholder={t('reader.search.placeholder')}
              aria-label={t('reader.search.inputLabel')}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label={t('reader.search.clear')}
                onClick={handleClearInput}
              >
                <X aria-hidden="true" size={15} strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
          <button
            className="book-search-submit"
            type="submit"
            disabled={!query.trim() || status === 'searching'}
          >
            {status === 'searching' ? t('reader.search.searching') : t('common.search')}
          </button>
        </form>

        <div className="book-search-status" role="status" aria-live="polite">
          {status === 'searching'
            ? progress.total > 0
              ? t('reader.search.progress', {
                  completed: progress.completed,
                  total: progress.total,
                })
              : t('reader.search.preparing')
            : status === 'complete'
              ? t('reader.search.found', { count: results.length, query: searchedQuery })
              : status === 'error'
                ? errorMessage
                : t('reader.search.hint')}
        </div>

        {status === 'complete' ? (
          results.length ? (
            <ol className="book-search-results">
              {results.map((result, index) => (
                <li key={`${result.cfi}-${index}`}>
                  <button type="button" onClick={() => onSelect(result)}>
                    <span className="book-search-result-chapter">
                      {result.chapter}
                    </span>
                    <span className="book-search-result-context">
                      <HighlightedExcerpt
                        text={result.excerpt}
                        query={searchedQuery}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="book-search-empty">
              <Search aria-hidden="true" size={22} strokeWidth={1.4} />
              <p>{t('reader.search.empty', { query: searchedQuery })}</p>
              <span>{t('reader.search.emptyHint')}</span>
            </div>
          )
        ) : status === 'idle' && recentSearches.length ? (
          <section className="recent-searches" aria-labelledby="recent-search-title">
            <div className="recent-searches-heading">
              <h2 id="recent-search-title">
                <Clock3 aria-hidden="true" size={14} strokeWidth={1.7} />
                {t('reader.search.recent')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches(bookId)
                  setRecentSearches([])
                }}
              >
                {t('common.clear')}
              </button>
            </div>
            <ul>
              {recentSearches.map((recentQuery) => (
                <li key={recentQuery}>
                  <button
                    type="button"
                    onClick={() => void runSearch(recentQuery)}
                  >
                    {recentQuery}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="toc-footer">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          {t('common.backToLibrary')}
        </button>
      </div>
    </aside>
  )
}
