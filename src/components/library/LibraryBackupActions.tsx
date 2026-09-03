import { useRef, useState } from 'react'
import { ArchiveRestore, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getCurrentLanguage } from '../../i18n'
import { getStorageErrorMessage } from '../../data/indexed-db/storage-capacity'
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
}, t: TFunction): string {
  const restoredCount =
    result.addedCount + result.overwrittenCount + result.keptBothCount
  if (restoredCount === 0) {
    return t('library.backup.noneRestored', { count: result.skippedCount })
  }

  const parts: string[] = []
  if (result.addedCount > 0) parts.push(t('library.backup.resultAdded', { count: result.addedCount }))
  if (result.overwrittenCount > 0) {
    parts.push(t('library.backup.resultOverwritten', { count: result.overwrittenCount }))
  }
  if (result.keptBothCount > 0) {
    parts.push(t('library.backup.resultKept', { count: result.keptBothCount }))
  }
  if (result.skippedCount > 0) parts.push(t('library.backup.resultSkipped', { count: result.skippedCount }))
  return t('library.backup.restored', {
    count: restoredCount,
    details: new Intl.ListFormat(getCurrentLanguage(), {
      style: 'short',
      type: 'conjunction',
    }).format(parts),
  })
}

export function LibraryBackupActions({
  hasBooks,
  onRestored,
  onAlert,
}: LibraryBackupActionsProps) {
  const { t } = useTranslation()
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
          : t('library.backup.genericError')),
    })
  }

  async function handleExport() {
    beginOperation('export')
    try {
      const { exportLibraryBackup } = await import('../../lib/library-backup')
      const result = await exportLibraryBackup()
      onAlert({
        kind: 'success',
        message: t('library.backup.exported', { count: result.bookCount }),
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
      onAlert({ kind: 'success', message: describeRestoreResult(result, t) })
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
          title={t('library.backup.exportTitle')}
        >
          <Download aria-hidden="true" size={17} strokeWidth={1.7} />
          <span>{operation === 'export' ? t('library.backup.exporting') : t('library.backup.export')}</span>
        </button>
        <button
          className="secondary-button library-utility-button"
          type="button"
          disabled={operation !== undefined}
          onClick={() => inputRef.current?.click()}
          title={t('library.backup.restoreTitle')}
        >
          <ArchiveRestore aria-hidden="true" size={17} strokeWidth={1.7} />
          <span>
            {operation === 'preview' ? t('library.backup.previewing') : t('library.backup.restore')}
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
