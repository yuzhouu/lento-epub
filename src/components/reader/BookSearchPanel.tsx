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
  PanelLeftClose,
  Search,
  X,
} from 'lucide-react'

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
  onShowToc,
}: BookSearchPanelProps) {
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
        error instanceof Error ? error.message : '暂时无法搜索这本书。',
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
    <aside className="toc-panel book-search-panel" aria-label="书内搜索">
      <div className="toc-header">
        <strong>卷舍</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">关闭书内搜索</span>
        </button>
      </div>

      <div className="navigation-tabs" aria-label="书内导航">
        <button type="button" onClick={onShowToc}>
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          目录
        </button>
        <button className="is-active" type="button" aria-current="page">
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          搜索
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
              placeholder="搜索正文"
              aria-label="搜索书中正文"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label="清空搜索"
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
            {status === 'searching' ? '搜索中' : '搜索'}
          </button>
        </form>

        <div className="book-search-status" role="status" aria-live="polite">
          {status === 'searching'
            ? progress.total > 0
              ? `正在搜索 ${progress.completed}/${progress.total} 节…`
              : '正在准备正文…'
            : status === 'complete'
              ? `找到 ${results.length} 处“${searchedQuery}”`
              : status === 'error'
                ? errorMessage
                : '输入词句，搜索整本书的正文'}
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
              <p>没有找到“{searchedQuery}”</p>
              <span>试试更短的词，或换一种写法</span>
            </div>
          )
        ) : status === 'idle' && recentSearches.length ? (
          <section className="recent-searches" aria-labelledby="recent-search-title">
            <div className="recent-searches-heading">
              <h2 id="recent-search-title">
                <Clock3 aria-hidden="true" size={14} strokeWidth={1.7} />
                最近搜索
              </h2>
              <button
                type="button"
                onClick={() => {
                  clearRecentSearches(bookId)
                  setRecentSearches([])
                }}
              >
                清除
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
          返回书架
        </button>
      </div>
    </aside>
  )
}
