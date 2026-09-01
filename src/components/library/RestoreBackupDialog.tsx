import { useEffect, useId, useRef, useState } from 'react'
import { ArchiveRestore, TriangleAlert } from 'lucide-react'
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
  label: string
  description: string
}> = [
  {
    value: 'overwrite',
    label: '覆盖现有',
    description: '采用备份中的 EPUB 与阅读进度',
  },
  {
    value: 'keep-both',
    label: '保留两本',
    description: '现有书不变，另存备份副本',
  },
  {
    value: 'skip',
    label: '跳过',
    description: '保留当前书架中的版本',
  },
]

function formatProgress(book: BookRecord): string {
  return `${Math.round(book.progress * 100)}%`
}

function formatLastOpened(book: BookRecord): string {
  if (!book.lastOpenedAt) return '尚未阅读'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(book.lastOpenedAt)
}

function formatExportedAt(exportedAt: string | undefined): string | undefined {
  if (!exportedAt) return undefined
  const timestamp = Date.parse(exportedAt)
  if (!Number.isFinite(timestamp)) return undefined
  return new Intl.DateTimeFormat('zh-CN', {
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
          <h2 id="restore-backup-title">恢复前确认</h2>
          <p id="restore-backup-description">
            {preview.bookCount} 本书 · {formatBytes(preview.totalBytes)}
            {exportedAt ? ` · 备份于 ${exportedAt}` : ''}
          </p>
        </div>
      </div>

      <div className="restore-preview-summary">
        <strong>{preview.directAddCount} 本可直接加入</strong>
        <span>
          {preview.conflicts.length > 0
            ? `${preview.conflicts.length} 本与当前书架冲突，请决定如何处理。`
            : '没有发现冲突，当前书架中的其他书不会被删除。'}
        </span>
      </div>

      {preview.conflicts.length > 0 ? (
        <>
          <div className="restore-conflict-toolbar">
            <span>批量选择</span>
            {RESTORE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={isRestoring}
                onClick={() => setAllResolutions(option.value)}
              >
                全部{option.label}
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
                      ? '同一书籍记录'
                      : 'EPUB 内容相同'}
                  </span>
                </header>

                <div className="restore-book-comparison">
                  <div>
                    <strong>当前书架</strong>
                    <span>阅读 {formatProgress(conflict.existingBook)}</span>
                    <span>
                      {conflict.existingBook.chapterLabel ||
                        formatLastOpened(conflict.existingBook)}
                    </span>
                  </div>
                  <div>
                    <strong>备份版本</strong>
                    <span>阅读 {formatProgress(conflict.backupBook)}</span>
                    <span>
                      {conflict.backupBook.chapterLabel ||
                        formatLastOpened(conflict.backupBook)}
                    </span>
                  </div>
                </div>

                <div
                  className="restore-resolution-options"
                  role="radiogroup"
                  aria-label={`《${conflict.backupBook.title}》的恢复方式`}
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
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
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
        <span>恢复只会合并这份备份，不会删除书架中的其他书。</span>
      </div>

      <div className="delete-dialog-actions restore-dialog-actions">
        <button
          ref={cancelButtonRef}
          className="secondary-button"
          type="button"
          disabled={isRestoring}
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={isRestoring}
          onClick={() => onConfirm(new Map(resolutions))}
        >
          {isRestoring ? '正在恢复…' : '确认恢复'}
        </button>
      </div>
    </dialog>
  )
}
