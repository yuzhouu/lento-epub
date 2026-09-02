import { useState } from 'react'
import {
  BookOpenText,
  Files,
  Search,
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
import type { BookOrganizationPatch } from '../../data/indexed-db/book-repository'
import type {
  BookRecord,
  DeletedBookEntry,
} from '../../types/book'
import { useLibraryQuery } from '../../features/library/hooks/useLibraryQuery'
import { useEpubDrop } from '../../features/library/hooks/useEpubDrop'
import { useLibraryStorage } from '../../features/library/hooks/useLibraryStorage'
import { LibraryToolbar } from '../../features/library/components/LibraryToolbar'
import { LibraryStorageSummary } from '../../features/library/components/LibraryStorageSummary'
import { useDeleteUndo } from '../../features/library/hooks/useDeleteUndo'

interface LibraryPageProps {
  books: BookRecord[]
  onImported: (books: BookRecord[]) => void
  onRestored: (books: BookRecord[]) => void
  onDelete: (id: string) => Promise<DeletedBookEntry | undefined>
  onUndoDelete: (entry: DeletedBookEntry) => Promise<void>
  onUpdateBook: (id: string, patch: BookOrganizationPatch) => Promise<void>
  onOpen: (id: string) => void
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
  const [libraryNotice, setLibraryNotice] = useState<LibraryAlertNotice>()
  const [managedBookId, setManagedBookId] = useState<string>()
  const importer = useBookImport(onImported, setLibraryNotice)
  const drop = useEpubDrop(importer.importFiles)
  const query = useLibraryQuery(books)
  const storageInfo = useLibraryStorage(books)
  const deletion = useDeleteUndo({
    onDelete,
    onUndoDelete,
    onNotice: setLibraryNotice,
    onDeleted: (bookId) => {
      if (bookId === managedBookId) setManagedBookId(undefined)
    },
  })

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

  const managedBook = managedBookId
    ? books.find((book) => book.id === managedBookId)
    : undefined


  return (
    <main
      className={`library-page${drop.isDraggingFiles ? ' is-dragging' : ''}`}
      {...drop.dropProps}
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
        <LibraryStorageSummary
          bookCount={books.length}
          visibleBookCount={query.visibleBooks.length}
          hasActiveFilters={query.hasActiveFilters}
          storageInfo={storageInfo}
        />

        {books.length ? (
          <>
            <LibraryToolbar
              searchQuery={query.searchQuery}
              sortBy={query.sortBy}
              statusFilter={query.statusFilter}
              favoriteOnly={query.favoriteOnly}
              activeTag={query.activeTag}
              allTags={query.allTags}
              hasActiveFilters={query.hasActiveFilters}
              onSearchQueryChange={query.setSearchQuery}
              onSortChange={query.setSortBy}
              onStatusFilterChange={query.setStatusFilter}
              onFavoriteToggle={() =>
                query.setFavoriteOnly((current) => !current)
              }
              onTagToggle={(tag) =>
                query.setActiveTag((current) =>
                  current === tag ? undefined : tag,
                )
              }
              onClear={query.clearFilters}
            />

            <div
              className={`library-books-layout${
                managedBook ? ' has-sidebar' : ''
              }`}
            >
              <div className="library-book-results">
                {query.visibleBooks.length ? (
                  <div
                    className="book-list"
                    aria-busy={query.isSearchPending}
                  >
                    {query.visibleBooks.map((book) => (
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
                        onRequestDelete={deletion.requestDelete}
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
                      onClick={query.clearFilters}
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

      {drop.isDraggingFiles ? (
        <div className="drop-import-overlay" aria-hidden="true">
          <Files size={38} strokeWidth={1.35} />
          <strong>松开以添加 EPUB</strong>
          <span>可以一次拖入多本书</span>
        </div>
      ) : null}

      {deletion.bookToDelete ? (
        <DeleteBookDialog
          book={deletion.bookToDelete}
          isDeleting={deletion.isDeleting}
          onCancel={() => deletion.cancelDelete()}
          onConfirm={() => void deletion.confirmDelete()}
        />
      ) : null}

      {libraryNotice || deletion.deletedEntry ? (
        <div className="library-toast-region">
          {libraryNotice ? (
            <LibraryAlert
              notice={libraryNotice}
              dismissLabel="关闭提示"
              onDismiss={() => setLibraryNotice(undefined)}
            />
          ) : null}
          {deletion.deletedEntry ? (
            <div className="library-toast delete-undo-toast" role="status">
              <strong>已删除《{deletion.deletedEntry.book.title}》。</strong>
              <button type="button" onClick={() => void deletion.undoDelete()}>
                撤销
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
