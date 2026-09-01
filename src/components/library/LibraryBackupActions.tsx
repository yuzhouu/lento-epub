import { useRef, useState } from 'react'
import { ArchiveRestore, Download } from 'lucide-react'
import { getStorageErrorMessage } from '../../lib/book-storage'
import { RestoreBackupDialog } from './RestoreBackupDialog'
import type { LibraryAlertNotice } from './LibraryAlert'
import type {
  LibraryBackupConflictResolution,
  LibraryBackupPreview,
} from '../../lib/library-backup'
import type { BookRecord } from '../../types/book'

interface LibraryBackupActionsProps {
  hasBooks: boolean
  onRestored: (books: BookRecord[]) => void
  onAlert: (notice: LibraryAlertNotice | undefined) => void
}

type BackupOperation = 'export' | 'preview' | 'restore'

function describeRestoreResult(result: {
  addedCount: number
  overwrittenCount: number
  keptBothCount: number
  skippedCount: number
}): string {
  const restoredCount =
    result.addedCount + result.overwrittenCount + result.keptBothCount
  if (restoredCount === 0) {
    return `没有恢复书籍，已跳过 ${result.skippedCount} 本冲突书籍。`
  }

  const parts: string[] = []
  if (result.addedCount > 0) parts.push(`新增 ${result.addedCount} 本`)
  if (result.overwrittenCount > 0) {
    parts.push(`覆盖 ${result.overwrittenCount} 本`)
  }
  if (result.keptBothCount > 0) {
    parts.push(`保留副本 ${result.keptBothCount} 本`)
  }
  if (result.skippedCount > 0) parts.push(`跳过 ${result.skippedCount} 本`)
  return `已恢复 ${restoredCount} 本书：${parts.join('，')}。`
}

export function LibraryBackupActions({
  hasBooks,
  onRestored,
  onAlert,
}: LibraryBackupActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [operation, setOperation] = useState<BackupOperation>()
  const [preview, setPreview] = useState<LibraryBackupPreview>()

  function beginOperation(nextOperation: BackupOperation) {
    setOperation(nextOperation)
    onAlert(undefined)
  }

  function finishWithError(backupError: unknown) {
    onAlert({
      kind: 'error',
      message:
        getStorageErrorMessage(backupError) ??
        (backupError instanceof Error
          ? backupError.message
          : '书库操作失败。'),
    })
  }

  async function handleExport() {
    beginOperation('export')
    try {
      const { exportLibraryBackup } = await import('../../lib/library-backup')
      const result = await exportLibraryBackup()
      onAlert({
        kind: 'success',
        message: `已导出 ${result.bookCount} 本书。`,
      })
    } catch (backupError) {
      finishWithError(backupError)
    } finally {
      setOperation(undefined)
    }
  }

  async function handlePreview(file: File | undefined) {
    if (!file) return
    beginOperation('preview')
    try {
      const { previewLibraryBackup } = await import('../../lib/library-backup')
      setPreview(await previewLibraryBackup(file))
    } catch (backupError) {
      finishWithError(backupError)
    } finally {
      setOperation(undefined)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRestore(
    resolutions: ReadonlyMap<string, LibraryBackupConflictResolution>,
  ) {
    if (!preview) return
    beginOperation('restore')
    try {
      const { restoreLibraryBackup } = await import('../../lib/library-backup')
      const result = await restoreLibraryBackup(preview, resolutions)
      onRestored(result.books)
      onAlert({ kind: 'success', message: describeRestoreResult(result) })
      setPreview(undefined)
    } catch (backupError) {
      setPreview(undefined)
      finishWithError(backupError)
    } finally {
      setOperation(undefined)
    }
  }

  return (
    <>
      <div className="library-backup-actions">
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".lento,application/zip"
          onChange={(event) => void handlePreview(event.target.files?.[0])}
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
          title="预览并恢复卷舍书库备份，不会删除现有书籍"
        >
          <ArchiveRestore aria-hidden="true" size={17} strokeWidth={1.7} />
          <span>
            {operation === 'preview' ? '正在读取…' : '恢复备份'}
          </span>
        </button>
      </div>

      {preview ? (
        <RestoreBackupDialog
          preview={preview}
          isRestoring={operation === 'restore'}
          onCancel={() => setPreview(undefined)}
          onConfirm={(resolutions) => void handleRestore(resolutions)}
        />
      ) : null}
    </>
  )
}
