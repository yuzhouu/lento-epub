import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Files,
  Search,
} from 'lucide-react'
import { BookRow } from './BookRow'
import { BookDetailsSidebar } from './BookDetailsSidebar'
import { DeleteBookDialog } from './DeleteBookDialog'
import { ImportBookButton } from './ImportBookButton'
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
import {
  LibraryStorageOverview,
  LibraryStorageSummary,
  LibraryStorageWarning,
} from '../../features/library/components/LibraryStorageSummary'
import { useDeleteUndo } from '../../features/library/hooks/useDeleteUndo'
import libraryEmptyArtwork from '../../assets/library-empty-book-alpha.webp'
import { LanguageSwitcher } from '../LanguageSwitcher'

interface LibraryPageProps {
  books: BookRecord[]
  libraryNotice: LibraryAlertNotice | undefined
  isImporting: boolean
  onImportFiles: (files: File[]) => Promise<void>
  onLibraryNoticeChange: (notice: LibraryAlertNotice | undefined) => void
  onRestored: (books: BookRecord[]) => void
  onDelete: (id: string) => Promise<DeletedBookEntry | undefined>
  onUndoDelete: (entry: DeletedBookEntry) => Promise<void>
  onUpdateBook: (id: string, patch: BookOrganizationPatch) => Promise<void>
  onOpen: (id: string) => void
}

export function LibraryPage({
  books,
  libraryNotice,
  isImporting,
  onImportFiles,
  onLibraryNoticeChange,
  onRestored,
  onDelete,
  onUndoDelete,
  onUpdateBook,
  onOpen,
}: LibraryPageProps) {
  const { t } = useTranslation()
  const [managedBookId, setManagedBookId] = useState<string>()
  const drop = useEpubDrop(onImportFiles)
  const query = useLibraryQuery(books)
  const storageInfo = useLibraryStorage(books)
  const deletion = useDeleteUndo({
    onDelete,
    onUndoDelete,
    onNotice: onLibraryNoticeChange,
    onDeleted: (bookId) => {
      if (bookId === managedBookId) setManagedBookId(undefined)
    },
  })

  async function handleUpdateBook(
    id: string,
    patch: BookOrganizationPatch,
  ): Promise<void> {
    onLibraryNoticeChange(undefined)
    try {
      await onUpdateBook(id, patch)
    } catch (updateError) {
      onLibraryNoticeChange({
        kind: 'error',
        message:
          updateError instanceof Error
            ? updateError.message
            : t('library.updateFailed'),
      })
      throw updateError
    }
  }

  const managedBook = managedBookId
    ? books.find((book) => book.id === managedBookId)
    : undefined


  return (
    <main
      className={`library-page${books.length ? '' : ' is-empty'}${
        drop.isDraggingFiles ? ' is-dragging' : ''
      }`}
      {...drop.dropProps}
    >
      <header className="library-header">
        <div className="brand-lockup">
          <h1>{t('common.brand')}</h1>
          <div className="brand-divider" />
          <div>
            <p>{t('common.tagline')}</p>
            <span>{t('common.slogan')}</span>
          </div>
        </div>
        <div className="library-actions">
          <InstallAppButton />
          <LibraryBackupActions
            hasBooks={books.length > 0}
            onRestored={onRestored}
            onAlert={onLibraryNoticeChange}
          />
          <ImportBookButton
            isImporting={isImporting}
            onFilesSelected={(files) => void onImportFiles(files)}
          />
        </div>
      </header>

      <section className="library-content" aria-labelledby="library-title">
        {books.length ? (
          <>
            <LibraryStorageSummary
              bookCount={books.length}
              visibleBookCount={query.visibleBooks.length}
              hasActiveFilters={query.hasActiveFilters}
              storageInfo={storageInfo}
            />

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
                    <h2>{t('library.searchEmptyTitle')}</h2>
                    <p>{t('library.searchEmptyBody')}</p>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={query.clearFilters}
                    >
                      {t('library.clearFilters')}
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
          <div className="library-empty-editorial">
            <div className="library-empty-copy">
              <div className="library-empty-heading">
                <h2 id="library-title">{t('library.heading')}</h2>
                <span>{t('common.books', { count: 0 })}</span>
              </div>

              <span className="library-empty-accent" aria-hidden="true" />

              <LibraryStorageWarning storageInfo={storageInfo} />

              <div className="empty-library">
                <h3>{t('library.emptyTitle')}</h3>
                <p>{t('library.emptyBody')}</p>
                <ImportBookButton
                  isImporting={isImporting}
                  onFilesSelected={(files) => void onImportFiles(files)}
                />
              </div>
            </div>

            <div className="library-empty-art" aria-hidden="true">
              <img src={libraryEmptyArtwork} alt="" />
            </div>
          </div>
        )}
      </section>

      <footer className="library-footer">
        <div className="library-footer-links">
          <nav aria-label={t('library.productInfo')}>
            <span>© yuzhou</span>
            <span className="library-footer-separator" aria-hidden="true">
              ·
            </span>
            <a href="#/about">{t('common.about')}</a>
            <span className="library-footer-separator" aria-hidden="true">
              ·
            </span>
            <a href="#/privacy">{t('common.privacy')}</a>
          </nav>
          <LanguageSwitcher compact />
        </div>
        {books.length ? null : (
          <LibraryStorageOverview storageInfo={storageInfo} />
        )}
      </footer>

      {drop.isDraggingFiles ? (
        <div className="drop-import-overlay" aria-hidden="true">
          <Files size={38} strokeWidth={1.35} />
          <strong>{t('library.dropTitle')}</strong>
          <span>{t('library.dropBody')}</span>
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
              dismissLabel={t('library.dismissNotice')}
              onDismiss={() => onLibraryNoticeChange(undefined)}
            />
          ) : null}
          {deletion.deletedEntry ? (
            <div className="library-toast delete-undo-toast" role="status">
              <strong>
                {t('library.deleted', {
                  title: deletion.deletedEntry.book.title,
                })}
              </strong>
              <button type="button" onClick={() => void deletion.undoDelete()}>
                {t('library.undo')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
