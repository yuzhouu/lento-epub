import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import {
  BookOpenText,
  Files,
  Search,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { BookRow } from './BookRow'
import { BookDetailsSidebar } from './BookDetailsSidebar'
import { DeleteBookDialog } from './DeleteBookDialog'
import { ImportBookButton, useBookImport } from './ImportBookButton'
import { InstallAppButton } from './InstallAppButton'
import {
  LibraryAlert,
  type LibraryAlertNotice,
} from './LibraryAlert'
import { LibraryBackupActions } from './LibraryBackupActions'
import {
  getLibraryStorageInfo,
  type BookOrganizationPatch,
  type LibraryStorageInfo,
} from '../../lib/book-storage'
import {
  BOOK_READING_STATUS_LABELS,
  BOOK_READING_STATUSES,
  getBookReadingStatus,
} from '../../lib/book-organization'
import { formatBytes } from '../../lib/format-bytes'
import type {
  BookReadingStatus,
  BookRecord,
  DeletedBookEntry,
} from '../../types/book'

interface LibraryPageProps {
  books: BookRecord[]
  onImported: (books: BookRecord[]) => void
  onRestored: (books: BookRecord[]) => void
  onDelete: (id: string) => Promise<DeletedBookEntry | undefined>
  onUndoDelete: (entry: DeletedBookEntry) => Promise<void>
  onUpdateBook: (id: string, patch: BookOrganizationPatch) => Promise<void>
  onOpen: (id: string) => void
}

type LibrarySort = 'recent' | 'added' | 'progress'
type ReadingStatusFilter = 'all' | BookReadingStatus

const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = {
  recent: '最近阅读',
  added: '添加时间',
  progress: '阅读进度',
}

const READING_STATUS_FILTERS: readonly ReadingStatusFilter[] = [
  'all',
  ...BOOK_READING_STATUSES,
]

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function containsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

function formatUsagePercent(value: number): string {
  if (value === 0) return '0%'
  if (value < 0.1) return '<0.1%'
  if (value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

export function LibraryPage({
  books,
  onImported,
  onRestored,
  onDelete,
  onUndoDelete,
  onUpdateBook,
  onOpen,
}: LibraryPageProps) {
  const dragDepthRef = useRef(0)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [bookToDelete, setBookToDelete] = useState<BookRecord>()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedEntry, setDeletedEntry] = useState<DeletedBookEntry>()
  const [libraryNotice, setLibraryNotice] = useState<LibraryAlertNotice>()
  const [storageInfo, setStorageInfo] = useState<LibraryStorageInfo>()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<LibrarySort>('recent')
  const [statusFilter, setStatusFilter] =
    useState<ReadingStatusFilter>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [activeTag, setActiveTag] = useState<string>()
  const [managedBookId, setManagedBookId] = useState<string>()
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const importer = useBookImport(onImported, setLibraryNotice)

  useEffect(() => {
    let isCurrent = true
    const bookBytes = books.reduce((total, book) => total + book.fileSize, 0)
    void getLibraryStorageInfo(bookBytes).then((info) => {
      if (isCurrent) setStorageInfo(info)
    })
    return () => {
      isCurrent = false
    }
  }, [books])

  useEffect(() => {
    if (!deletedEntry) return
    const timeout = window.setTimeout(() => setDeletedEntry(undefined), 8000)
    return () => window.clearTimeout(timeout)
  }, [deletedEntry])

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (dragDepthRef.current === 0) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingFiles(false)
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event) && event.dataTransfer.files.length === 0) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)
    void importer.importFiles(Array.from(event.dataTransfer.files))
  }

  async function handleDeleteConfirmed() {
    if (!bookToDelete || isDeleting) return
    setIsDeleting(true)
    setLibraryNotice(undefined)
    try {
      const deleted = await onDelete(bookToDelete.id)
      setBookToDelete(undefined)
      if (deleted) {
        if (deleted.book.id === managedBookId) setManagedBookId(undefined)
        setDeletedEntry(deleted.data ? deleted : undefined)
        if (!deleted.data) {
          setLibraryNotice({
            kind: 'success',
            message: `已删除《${deleted.book.title}》，原 EPUB 文件此前已丢失，无法撤销。`,
          })
        }
      }
    } catch (deleteError) {
      setBookToDelete(undefined)
      setLibraryNotice({
        kind: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : '删除书籍失败。',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleUndoDelete() {
    if (!deletedEntry) return
    const entry = deletedEntry
    setDeletedEntry(undefined)
    try {
      await onUndoDelete(entry)
      setLibraryNotice({
        kind: 'success',
        message: `已恢复《${entry.book.title}》。`,
      })
    } catch (restoreError) {
      setLibraryNotice({
        kind: 'error',
        message:
          restoreError instanceof Error
            ? restoreError.message
            : '撤销删除失败。',
      })
    }
  }

  async function handleUpdateBook(
    id: string,
    patch: BookOrganizationPatch,
  ): Promise<void> {
    setLibraryNotice(undefined)
    try {
      await onUpdateBook(id, patch)
    } catch (updateError) {
      setLibraryNotice({
        kind: 'error',
        message:
          updateError instanceof Error
            ? updateError.message
            : '更新书籍信息失败。',
      })
      throw updateError
    }
  }

  function clearLibraryFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setFavoriteOnly(false)
    setActiveTag(undefined)
  }

  const allTags = useMemo(() => {
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
  }, [books])

  const effectiveActiveTag =
    activeTag && allTags.includes(activeTag) ? activeTag : undefined
  const visibleBooks = useMemo(() => {
    const queryTokens = normalizeSearchValue(deferredSearchQuery)
      .split(/\s+/)
      .filter(Boolean)
    const activeTagKey = effectiveActiveTag
      ? normalizeSearchValue(effectiveActiveTag)
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
        statusFilter !== 'all' &&
        getBookReadingStatus(book) !== statusFilter
      ) {
        return false
      }
      if (favoriteOnly && !book.isFavorite) return false
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
      if (sortBy === 'added') return right.addedAt - left.addedAt
      if (sortBy === 'progress') {
        return right.progress - left.progress || right.addedAt - left.addedAt
      }
      return (
        (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0) ||
        right.addedAt - left.addedAt
      )
    })
  }, [
    books,
    deferredSearchQuery,
    effectiveActiveTag,
    favoriteOnly,
    sortBy,
    statusFilter,
  ])

  const hasActiveFilters = Boolean(
    searchQuery ||
      statusFilter !== 'all' ||
      favoriteOnly ||
      effectiveActiveTag,
  )
  const managedBook = managedBookId
    ? books.find((book) => book.id === managedBookId)
    : undefined

  const usagePercent =
    storageInfo?.usedBytes !== undefined && storageInfo.quotaBytes
      ? Math.min(100, (storageInfo.usedBytes / storageInfo.quotaBytes) * 100)
      : undefined

  return (
    <main
      className={`library-page${isDraggingFiles ? ' is-dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="library-header">
        <div className="brand-lockup">
          <h1>卷舍 · Lento</h1>
          <div className="brand-divider" />
          <div>
            <p>把时间留给书。</p>
            <span>Read without hurry.</span>
          </div>
        </div>
        <div className="library-actions">
          <InstallAppButton />
          <LibraryBackupActions
            hasBooks={books.length > 0}
            onRestored={onRestored}
            onAlert={setLibraryNotice}
          />
          <ImportBookButton
            isImporting={importer.isImporting}
            onFilesSelected={(files) => void importer.importFiles(files)}
          />
        </div>
      </header>

      <section className="library-content" aria-labelledby="library-title">
        <div className="section-heading">
          <div className="library-heading-copy">
            <h2 id="library-title">我的书架</h2>
            <span>
              {hasActiveFilters
                ? `${visibleBooks.length} / ${books.length} 本书`
                : `${books.length} 本书`}
            </span>
            <div
              className={`library-storage-overview${
                storageInfo?.isLow ? ' is-low' : ''
              }`}
              role="status"
              title="包含 EPUB 文件、阅读数据与离线应用缓存"
            >
              {storageInfo ? (
                storageInfo.quotaBytes !== undefined ? (
                  <>
                    <span>总占用</span>
                    <span className="library-storage-value">
                      {formatBytes(
                        storageInfo.usedBytes ?? storageInfo.bookBytes,
                      )}{' '}
                      / {formatBytes(storageInfo.quotaBytes)}
                    </span>
                    <span className="library-storage-percent">
                      {formatUsagePercent(usagePercent ?? 0)}
                    </span>
                  </>
                ) : (
                  <span>书籍占用 {formatBytes(storageInfo.bookBytes)}</span>
                )
              ) : (
                <span>正在统计空间…</span>
              )}
            </div>
          </div>
        </div>

        {storageInfo?.isLow ? (
          <div className="library-storage-warning" role="alert">
            <TriangleAlert aria-hidden="true" size={19} strokeWidth={1.7} />
            <div>
              <strong>浏览器存储空间不足</strong>
              <span>
                {storageInfo.availableBytes !== undefined
                  ? `仅剩约 ${formatBytes(storageInfo.availableBytes)}，继续添加或恢复书籍可能失败。`
                  : '继续添加或恢复书籍可能失败。'}
                请先删除不再需要的书，或释放设备空间。
              </span>
            </div>
          </div>
        ) : null}

        {books.length ? (
          <>
            <div className="library-management" aria-label="管理书架">
              <div className="library-management-primary">
                <label className="library-search-field">
                  <Search aria-hidden="true" size={17} strokeWidth={1.7} />
                  <span className="visually-hidden">搜索书名或作者</span>
                  <input
                    type="search"
                    value={searchQuery}
                    placeholder="搜索书名或作者"
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
                <label className="library-sort-field">
                  <span>排序</span>
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as LibrarySort)
                    }
                  >
                    {Object.entries(LIBRARY_SORT_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
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
                      onClick={() => setStatusFilter(status)}
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
                  onClick={() => setFavoriteOnly((current) => !current)}
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
                  <button
                    className="library-clear-filters"
                    type="button"
                    onClick={clearLibraryFilters}
                  >
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
                        className={
                          effectiveActiveTag === tag ? 'is-active' : ''
                        }
                        aria-pressed={effectiveActiveTag === tag}
                        onClick={() =>
                          setActiveTag((current) =>
                            current === tag ? undefined : tag,
                          )
                        }
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={`library-books-layout${
                managedBook ? ' has-sidebar' : ''
              }`}
            >
              <div className="library-book-results">
                {visibleBooks.length ? (
                  <div
                    className="book-list"
                    aria-busy={searchQuery !== deferredSearchQuery}
                  >
                    {visibleBooks.map((book) => (
                      <BookRow
                        key={book.id}
                        book={book}
                        isManaged={managedBook?.id === book.id}
                        onOpen={onOpen}
                        onManage={(id) =>
                          setManagedBookId((current) =>
                            current === id ? undefined : id,
                          )
                        }
                        onRequestDelete={setBookToDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-library empty-library-filtered">
                    <Search aria-hidden="true" size={34} strokeWidth={1.25} />
                    <h2>没有找到符合条件的书</h2>
                    <p>换一个关键词，或清除当前筛选。</p>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={clearLibraryFilters}
                    >
                      清除筛选
                    </button>
                  </div>
                )}
              </div>

              {managedBook ? (
                <BookDetailsSidebar
                  key={managedBook.id}
                  book={managedBook}
                  onClose={() => setManagedBookId(undefined)}
                  onUpdate={handleUpdateBook}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-library">
            <BookOpenText aria-hidden="true" size={40} strokeWidth={1.2} />
            <h2>这里还没有书</h2>
            <p>选择或拖入 EPUB 文件，从一册书开始。</p>
            <ImportBookButton
              compact
              isImporting={importer.isImporting}
              onFilesSelected={(files) => void importer.importFiles(files)}
            />
          </div>
        )}
      </section>

      {isDraggingFiles ? (
        <div className="drop-import-overlay" aria-hidden="true">
          <Files size={38} strokeWidth={1.35} />
          <strong>松开以添加 EPUB</strong>
          <span>可以一次拖入多本书</span>
        </div>
      ) : null}

      {bookToDelete ? (
        <DeleteBookDialog
          book={bookToDelete}
          isDeleting={isDeleting}
          onCancel={() => setBookToDelete(undefined)}
          onConfirm={() => void handleDeleteConfirmed()}
        />
      ) : null}

      {libraryNotice || deletedEntry ? (
        <div className="library-toast-region">
          {libraryNotice ? (
            <LibraryAlert
              notice={libraryNotice}
              dismissLabel="关闭提示"
              onDismiss={() => setLibraryNotice(undefined)}
            />
          ) : null}
          {deletedEntry ? (
            <div className="library-toast delete-undo-toast" role="status">
              <strong>已删除《{deletedEntry.book.title}》。</strong>
              <button type="button" onClick={() => void handleUndoDelete()}>
                撤销
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
