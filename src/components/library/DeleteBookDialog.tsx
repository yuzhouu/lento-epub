import { useEffect, useRef } from 'react'
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
      <h2 id="delete-book-title">删除这本书？</h2>
      <p id="delete-book-description">
        将从这台设备删除《{book.title}》、EPUB 文件和阅读进度。删除后 8
        秒内可以撤销。
      </p>
      <div className="delete-dialog-actions">
        <button
          className="secondary-button"
          type="button"
          autoFocus
          disabled={isDeleting}
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? '正在删除…' : '删除书籍'}
        </button>
      </div>
    </dialog>
  )
}
