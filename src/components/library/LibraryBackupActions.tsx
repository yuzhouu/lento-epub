import { useRef, useState } from 'react'
import { ArchiveRestore, Download } from 'lucide-react'
import { getStorageErrorMessage } from '../../lib/book-storage'
import type { BookRecord } from '../../types/book'

interface LibraryBackupActionsProps {
  hasBooks: boolean
  onRestored: (books: BookRecord[]) => void
}

type BackupOperation = 'export' | 'import'

export function LibraryBackupActions({
  hasBooks,
  onRestored,
}: LibraryBackupActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [operation, setOperation] = useState<BackupOperation>()
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()

  function beginOperation(nextOperation: BackupOperation) {
    setOperation(nextOperation)
    setMessage(undefined)
    setError(undefined)
  }

  function finishWithError(backupError: unknown) {
    setError(
      getStorageErrorMessage(backupError) ??
        (backupError instanceof Error
          ? backupError.message
          : '书库操作失败。'),
    )
  }

  async function handleExport() {
    beginOperation('export')
    try {
      const { exportLibraryBackup } = await import('../../lib/library-backup')
      const result = await exportLibraryBackup()
      setMessage(`已导出 ${result.bookCount} 本书。`)
    } catch (backupError) {
      finishWithError(backupError)
    } finally {
      setOperation(undefined)
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    beginOperation('import')
    try {
      const { importLibraryBackup } = await import('../../lib/library-backup')
      const result = await importLibraryBackup(file)
      if (result.books) onRestored(result.books)
      setMessage(`已恢复 ${result.bookCount} 本书。`)
    } catch (backupError) {
      finishWithError(backupError)
    } finally {
      setOperation(undefined)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="library-backup-actions">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".lento,application/zip"
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />
      <button
        className="secondary-button library-utility-button"
        type="button"
        disabled={!hasBooks || operation !== undefined}
        onClick={() => void handleExport()}
        title="导出包含 EPUB 和阅读进度的书库备份"
      >
        <Download aria-hidden="true" size={17} strokeWidth={1.7} />
        <span>{operation === 'export' ? '正在备份…' : '备份书库'}</span>
      </button>
      <button
        className="secondary-button library-utility-button"
        type="button"
        disabled={operation !== undefined}
        onClick={() => inputRef.current?.click()}
        title="从卷舍书库备份恢复，不会删除现有书籍"
      >
        <ArchiveRestore aria-hidden="true" size={17} strokeWidth={1.7} />
        <span>{operation === 'import' ? '正在恢复…' : '恢复备份'}</span>
      </button>
      {message ? (
        <p className="library-action-message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="library-action-message is-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
