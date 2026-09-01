import { BookOpenText } from 'lucide-react'
import { BookRow } from './BookRow'
import { ImportBookButton } from './ImportBookButton'
import { InstallAppButton } from './InstallAppButton'
import { LibraryBackupActions } from './LibraryBackupActions'
import type { BookRecord } from '../../types/book'

interface LibraryPageProps {
  books: BookRecord[]
  onImported: (book: BookRecord) => void
  onRestored: (books: BookRecord[]) => void
  onOpen: (id: string) => void
}

export function LibraryPage({
  books,
  onImported,
  onRestored,
  onOpen,
}: LibraryPageProps) {
  return (
    <main className="library-page">
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
          <ImportBookButton onImported={onImported} />
        </div>
      </header>

      <section className="library-content" aria-labelledby="library-title">
        <div className="section-heading">
          <h2 id="library-title">我的书架</h2>
          <span>{books.length} 本书</span>
        </div>

        {books.length ? (
          <div className="book-list">
            {books.map((book) => (
              <BookRow key={book.id} book={book} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="empty-library">
            <BookOpenText aria-hidden="true" size={40} strokeWidth={1.2} />
            <h2>这里还没有书</h2>
            <p>从一册 EPUB 开始，慢慢读。</p>
            <ImportBookButton compact onImported={onImported} />
          </div>
        )}
      </section>
    </main>
  )
}
