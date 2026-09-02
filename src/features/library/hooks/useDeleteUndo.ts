import { useEffect, useState } from 'react'
import type { LibraryAlertNotice } from '../../../components/library/LibraryAlert'
import type {
  BookRecord,
  DeletedBookEntry,
} from '../../../types/book'

interface UseDeleteUndoOptions {
  onDelete: (id: string) => Promise<DeletedBookEntry | undefined>
  onUndoDelete: (entry: DeletedBookEntry) => Promise<void>
  onNotice: (notice: LibraryAlertNotice | undefined) => void
  onDeleted: (bookId: string) => void
}

export function useDeleteUndo({
  onDelete,
  onUndoDelete,
  onNotice,
  onDeleted,
}: UseDeleteUndoOptions) {
  const [bookToDelete, setBookToDelete] = useState<BookRecord>()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedEntry, setDeletedEntry] = useState<DeletedBookEntry>()

  useEffect(() => {
    if (!deletedEntry) return
    const timeout = window.setTimeout(() => setDeletedEntry(undefined), 8000)
    return () => window.clearTimeout(timeout)
  }, [deletedEntry])

  async function confirmDelete() {
    if (!bookToDelete || isDeleting) return
    setIsDeleting(true)
    onNotice(undefined)
    try {
      const deleted = await onDelete(bookToDelete.id)
      setBookToDelete(undefined)
      if (!deleted) return
      onDeleted(deleted.book.id)
      setDeletedEntry(deleted.data ? deleted : undefined)
      if (!deleted.data) {
        onNotice({
          kind: 'success',
          message: `已删除《${deleted.book.title}》，原 EPUB 文件此前已丢失，无法撤销。`,
        })
      }
    } catch (error) {
      setBookToDelete(undefined)
      onNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '删除书籍失败。',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function undoDelete() {
    if (!deletedEntry) return
    const entry = deletedEntry
    setDeletedEntry(undefined)
    try {
      await onUndoDelete(entry)
      onNotice({
        kind: 'success',
        message: `已恢复《${entry.book.title}》。`,
      })
    } catch (error) {
      onNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '撤销删除失败。',
      })
    }
  }

  return {
    bookToDelete,
    isDeleting,
    deletedEntry,
    requestDelete: setBookToDelete,
    cancelDelete: () => setBookToDelete(undefined),
    confirmDelete,
    undoDelete,
  }
}
