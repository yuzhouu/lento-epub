import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { LibraryPage } from './components/library/LibraryPage'
import { useBookImport } from './components/library/ImportBookButton'
import type { LibraryAlertNotice } from './components/library/LibraryAlert'
import {
  deleteBook,
  getBooks,
  restoreDeletedBook,
  updateBookOrganization,
  type BookOrganizationPatch,
} from './data/indexed-db/book-repository'
import { subscribeToEpubFileLaunch } from './features/library/model/epub-file-launch'
import type { BookRecord, DeletedBookEntry } from './types/book'

const ReaderPage = lazy(() =>
  import('./components/reader/ReaderPage').then((module) => ({
    default: module.ReaderPage,
  })),
)

function getBookIdFromHash(): string | undefined {
  const match = window.location.hash.match(/^#\/book\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : undefined
}

export function App() {
  const [books, setBooks] = useState<BookRecord[]>([])
  const [activeBookId, setActiveBookId] = useState(getBookIdFromHash)
  const [isLoading, setIsLoading] = useState(true)
  const [libraryNotice, setLibraryNotice] = useState<LibraryAlertNotice>()

  const handleImported = useCallback((importedBooks: BookRecord[]) => {
    setBooks((current) => [...importedBooks, ...current])
  }, [])

  const handleOpen = useCallback((id: string) => {
    window.location.hash = `/book/${encodeURIComponent(id)}`
  }, [])

  const handleBack = useCallback(() => {
    window.location.hash = '/'
  }, [])

  const importer = useBookImport(
    handleImported,
    setLibraryNotice,
    handleOpen,
  )

  useEffect(() => {
    void getBooks()
      .then(setBooks)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const handleHashChange = () => setActiveBookId(getBookIdFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (__LENTO_BUILD_TARGET__ !== 'web' || isLoading) return

    return subscribeToEpubFileLaunch((event) => {
      handleBack()
      if (event.kind === 'error') {
        setLibraryNotice({ kind: 'error', message: event.message })
        return
      }
      void importer.importFiles(event.files, { openSingle: true })
    })
  }, [handleBack, importer.importFiles, isLoading])

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId),
    [activeBookId, books],
  )

  function handleRestored(restoredBooks: BookRecord[]) {
    setBooks(restoredBooks)
  }

  function handleBookUpdate(updatedBook: BookRecord) {
    setBooks((current) =>
      current.map((book) => (book.id === updatedBook.id ? updatedBook : book)),
    )
  }

  async function handleBookOrganizationUpdate(
    id: string,
    patch: BookOrganizationPatch,
  ): Promise<void> {
    const updatedBook = await updateBookOrganization(id, patch)
    if (!updatedBook) throw new Error('找不到这本书。')
    handleBookUpdate(updatedBook)
  }

  async function handleDelete(
    id: string,
  ): Promise<DeletedBookEntry | undefined> {
    const deleted = await deleteBook(id)
    if (deleted) {
      setBooks((current) => current.filter((book) => book.id !== id))
    }
    return deleted
  }

  async function handleUndoDelete(entry: DeletedBookEntry): Promise<void> {
    await restoreDeletedBook(entry)
    setBooks(await getBooks())
  }

  if (isLoading) {
    return (
      <main className="loading-screen">
        <span>卷舍 · Lento</span>
      </main>
    )
  }

  if (activeBookId && activeBook) {
    return (
      <Suspense
        fallback={
          <main className="loading-screen">
            <span>正在翻开…</span>
          </main>
        }
      >
        <ReaderPage
          bookRecord={activeBook}
          onBack={handleBack}
          onBookUpdate={handleBookUpdate}
        />
      </Suspense>
    )
  }

  return (
    <LibraryPage
      books={books}
      libraryNotice={libraryNotice}
      isImporting={importer.isImporting}
      onImportFiles={importer.importFiles}
      onLibraryNoticeChange={setLibraryNotice}
      onRestored={handleRestored}
      onDelete={handleDelete}
      onUndoDelete={handleUndoDelete}
      onUpdateBook={handleBookOrganizationUpdate}
      onOpen={handleOpen}
    />
  )
}
