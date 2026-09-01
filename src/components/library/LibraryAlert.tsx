import { X } from 'lucide-react'

export interface LibraryAlertNotice {
  kind: 'success' | 'error'
  message: string
  detail?: string
}

interface LibraryAlertProps {
  notice: LibraryAlertNotice
  dismissLabel: string
  onDismiss: () => void
}

export function LibraryAlert({
  notice,
  dismissLabel,
  onDismiss,
}: LibraryAlertProps) {
  return (
    <div
      className={`library-toast${notice.kind === 'error' ? ' is-error' : ''}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <div>
        <strong>{notice.message}</strong>
        {notice.detail ? <span>{notice.detail}</span> : null}
      </div>
      <button type="button" aria-label={dismissLabel} onClick={onDismiss}>
        <X aria-hidden="true" size={17} />
      </button>
    </div>
  )
}
