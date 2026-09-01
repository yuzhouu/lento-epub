import { useEffect, useRef, useState, type DragEvent } from 'react'
import { BookOpenText, Files, TriangleAlert, X } from 'lucide-react'
import { BookRow } from './BookRow'
import { DeleteBookDialog } from './DeleteBookDialog'
import { ImportBookButton, useBookImport } from './ImportBookButton'
import { InstallAppButton } from './InstallAppButton'
import { LibraryBackupActions } from './LibraryBackupActions'
import {
  getLibraryStorageInfo,
  type LibraryStorageInfo,
} from '../../lib/book-storage'
import { formatBytes } from '../../lib/format-bytes'
import type { BookRecord, DeletedBookEntry } from '../../types/book'

interface LibraryPageProps {
  books: BookRecord[]
  onImported: (books: BookRecord[]) => void
  onRestored: (books: BookRecord[]) => void
  onDelete: (id: string) => Promise<DeletedBookEntry | undefined>
  onUndoDelete: (entry: DeletedBookEntry) => Promise<void>
  onOpen: (id: string) => void
}

interface LibraryNotice {
  kind: 'success' | 'error'
  message: string
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
  onOpen,
}: LibraryPageProps) {
  const dragDepthRef = useRef(0)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [bookToDelete, setBookToDelete] = useState<BookRecord>()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedEntry, setDeletedEntry] = useState<DeletedBookEntry>()
  const [libraryNotice, setLibraryNotice] = useState<LibraryNotice>()
  const [storageInfo, setStorageInfo] = useState<LibraryStorageInfo>()
  const importer = useBookImport(onImported)

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
            <span>{books.length} 本书</span>
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
          <div className="book-list">
            {books.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onOpen={onOpen}
                onRequestDelete={setBookToDelete}
              />
            ))}
          </div>
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

      {importer.notice || libraryNotice || deletedEntry ? (
        <div className="library-toast-region">
          {importer.notice ? (
            <div
              className={`library-toast${
                importer.notice.kind === 'error' ? ' is-error' : ''
              }`}
              role={importer.notice.kind === 'error' ? 'alert' : 'status'}
            >
              <div>
                <strong>{importer.notice.message}</strong>
                {importer.notice.detail ? (
                  <span>{importer.notice.detail}</span>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="关闭导入结果"
                onClick={importer.clearNotice}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          ) : null}
          {libraryNotice ? (
            <div
              className={`library-toast${
                libraryNotice.kind === 'error' ? ' is-error' : ''
              }`}
              role={libraryNotice.kind === 'error' ? 'alert' : 'status'}
            >
              <strong>{libraryNotice.message}</strong>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => setLibraryNotice(undefined)}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
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
