import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { LibraryPage } from './components/library/LibraryPage'
import { getBooks } from './lib/book-storage'
import type { BookRecord } from './types/book'

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

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId),
    [activeBookId, books],
  )

  function handleImported(book: BookRecord) {
    setBooks((current) => [book, ...current])
  }

  function handleRestored(restoredBooks: BookRecord[]) {
    setBooks(restoredBooks)
  }

  function handleBookUpdate(updatedBook: BookRecord) {
    setBooks((current) =>
      current.map((book) => (book.id === updatedBook.id ? updatedBook : book)),
    )
  }

  function handleOpen(id: string) {
    window.location.hash = `/book/${encodeURIComponent(id)}`
  }

  function handleBack() {
    window.location.hash = '/'
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
      onImported={handleImported}
      onRestored={handleRestored}
      onOpen={handleOpen}
    />
  )
}
