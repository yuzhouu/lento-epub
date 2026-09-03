import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { BookRecord } from '../../types/book'

interface DeleteBookDialogProps {
  book: BookRecord
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteBookDialog({
  book,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteBookDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="delete-book-dialog"
      aria-labelledby="delete-book-title"
      aria-describedby="delete-book-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!isDeleting) onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onCancel()
      }}
    >
      <h2 id="delete-book-title">{t('library.deleteDialog.title')}</h2>
      <p id="delete-book-description">
        {t('library.deleteDialog.description', { title: book.title })}
      </p>
      <div className="delete-dialog-actions">
        <button
          className="secondary-button"
          type="button"
          autoFocus
          disabled={isDeleting}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting
            ? t('library.deleteDialog.deleting')
            : t('library.deleteDialog.confirm')}
        </button>
      </div>
    </dialog>
  )
}
