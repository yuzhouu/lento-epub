import { useEffect, useId, useRef, useState } from 'react'
import { ArchiveRestore, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getCurrentLanguage } from '../../i18n'
import { formatBytes } from '../../lib/format-bytes'
import type {
  LibraryBackupConflictResolution,
  LibraryBackupPreview,
} from '../../lib/library-backup'
import type { BookRecord } from '../../types/book'

interface RestoreBackupDialogProps {
  preview: LibraryBackupPreview
  isRestoring: boolean
  onCancel: () => void
  onConfirm: (
    resolutions: ReadonlyMap<string, LibraryBackupConflictResolution>,
  ) => void
}

const RESTORE_OPTIONS: Array<{
  value: LibraryBackupConflictResolution
  labelKey: string
  descriptionKey: string
}> = [
  {
    value: 'overwrite',
    labelKey: 'library.restore.overwrite',
    descriptionKey: 'library.restore.overwriteDescription',
  },
  {
    value: 'keep-both',
    labelKey: 'library.restore.keepBoth',
    descriptionKey: 'library.restore.keepBothDescription',
  },
  {
    value: 'skip',
    labelKey: 'library.restore.skip',
    descriptionKey: 'library.restore.skipDescription',
  },
]

function formatProgress(book: BookRecord): string {
  return `${Math.round(book.progress * 100)}%`
}

function formatLastOpened(book: BookRecord, t: TFunction): string {
  if (!book.lastOpenedAt) return t('library.restore.unread')
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(book.lastOpenedAt)
}

function formatExportedAt(exportedAt: string | undefined): string | undefined {
  if (!exportedAt) return undefined
  const timestamp = Date.parse(exportedAt)
  if (!Number.isFinite(timestamp)) return undefined
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function RestoreBackupDialog({
  preview,
  isRestoring,
  onCancel,
  onConfirm,
}: RestoreBackupDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const radioGroupId = useId()
  const [resolutions, setResolutions] = useState(
    () =>
      new Map<string, LibraryBackupConflictResolution>(
        preview.conflicts.map(({ backupBook }) => [backupBook.id, 'skip']),
      ),
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      cancelButtonRef.current?.focus()
    }
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  function setResolution(
    bookId: string,
    resolution: LibraryBackupConflictResolution,
  ) {
    setResolutions((current) => {
      const next = new Map(current)
      next.set(bookId, resolution)
      return next
    })
  }

  function setAllResolutions(resolution: LibraryBackupConflictResolution) {
    setResolutions(
      new Map(
        preview.conflicts.map(({ backupBook }) => [
          backupBook.id,
          resolution,
        ]),
      ),
    )
  }

  const exportedAt = formatExportedAt(preview.exportedAt)

  return (
    <dialog
      ref={dialogRef}
      className="delete-book-dialog restore-backup-dialog"
      aria-labelledby="restore-backup-title"
      aria-describedby="restore-backup-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!isRestoring) onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isRestoring) onCancel()
      }}
    >
      <div className="restore-dialog-heading">
        <ArchiveRestore aria-hidden="true" size={24} strokeWidth={1.55} />
        <div>
          <h2 id="restore-backup-title">{t('library.restore.title')}</h2>
          <p id="restore-backup-description">
            {t('library.restore.summary', { count: preview.bookCount, size: formatBytes(preview.totalBytes) })}
            {exportedAt ? ` · ${t('library.restore.exportedAt', { date: exportedAt })}` : ''}
          </p>
        </div>
      </div>

      <div className="restore-preview-summary">
        <strong>{t('library.restore.direct', { count: preview.directAddCount })}</strong>
        <span>
          {preview.conflicts.length > 0
            ? t('library.restore.conflicts', { count: preview.conflicts.length })
            : t('library.restore.noConflicts')}
        </span>
      </div>

      {preview.conflicts.length > 0 ? (
        <>
          <div className="restore-conflict-toolbar">
            <span>{t('library.restore.bulk')}</span>
            {RESTORE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={isRestoring}
                onClick={() => setAllResolutions(option.value)}
              >
                {t('library.restore.allOption', { option: t(option.labelKey) })}
              </button>
            ))}
          </div>

          <div className="restore-conflict-list">
            {preview.conflicts.map((conflict, conflictIndex) => (
              <article
                key={conflict.backupBook.id}
                className="restore-conflict-card"
              >
                <header>
                  <div>
                    <h3>《{conflict.backupBook.title}》</h3>
                    <span>{conflict.backupBook.author}</span>
                  </div>
                  <span className="restore-conflict-reason">
                    <TriangleAlert
                      aria-hidden="true"
                      size={14}
                      strokeWidth={1.8}
                    />
                    {conflict.reason === 'id'
                      ? t('library.restore.sameRecord')
                      : t('library.restore.sameContent')}
                  </span>
                </header>

                <div className="restore-book-comparison">
                  <div>
                    <strong>{t('library.restore.current')}</strong>
                    <span>{t('library.restore.reading', { progress: formatProgress(conflict.existingBook) })}</span>
                    <span>
                      {conflict.existingBook.chapterLabel ||
                        formatLastOpened(conflict.existingBook, t)}
                    </span>
                  </div>
                  <div>
                    <strong>{t('library.restore.backup')}</strong>
                    <span>{t('library.restore.reading', { progress: formatProgress(conflict.backupBook) })}</span>
                    <span>
                      {conflict.backupBook.chapterLabel ||
                        formatLastOpened(conflict.backupBook, t)}
                    </span>
                  </div>
                </div>

                <div
                  className="restore-resolution-options"
                  role="radiogroup"
                  aria-label={t('library.restore.resolutionLabel', { title: conflict.backupBook.title })}
                >
                  {RESTORE_OPTIONS.map((option) => {
                    const inputId = `${radioGroupId}-${conflictIndex}-${option.value}`
                    return (
                      <label
                        key={option.value}
                        className={
                          resolutions.get(conflict.backupBook.id) ===
                          option.value
                            ? 'is-selected'
                            : undefined
                        }
                        htmlFor={inputId}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name={`${radioGroupId}-${conflictIndex}`}
                          value={option.value}
                          checked={
                            resolutions.get(conflict.backupBook.id) ===
                            option.value
                          }
                          disabled={isRestoring}
                          onChange={() =>
                            setResolution(
                              conflict.backupBook.id,
                              option.value,
                            )
                          }
                        />
                        <span>
                          <strong>{t(option.labelKey)}</strong>
                          <small>{t(option.descriptionKey)}</small>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="restore-dialog-note">
        <span>{preview.sourceName}</span>
        <span>{t('library.restore.note')}</span>
      </div>

      <div className="delete-dialog-actions restore-dialog-actions">
        <button
          ref={cancelButtonRef}
          className="secondary-button"
          type="button"
          disabled={isRestoring}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={isRestoring}
          onClick={() => onConfirm(new Map(resolutions))}
        >
          {isRestoring ? t('library.restore.restoring') : t('library.restore.confirm')}
        </button>
      </div>
    </dialog>
  )
}
