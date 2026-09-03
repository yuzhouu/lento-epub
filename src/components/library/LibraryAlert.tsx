import { useEffect, useEffectEvent } from 'react'
import { X } from 'lucide-react'

export const LIBRARY_ALERT_DURATION_MS = 8000

export function scheduleLibraryAlertDismiss(
  onDismiss: () => void,
): () => void {
  const timeout = setTimeout(onDismiss, LIBRARY_ALERT_DURATION_MS)
  return () => clearTimeout(timeout)
}

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
  const dismiss = useEffectEvent(onDismiss)

  useEffect(
    () => scheduleLibraryAlertDismiss(dismiss),
    [notice],
  )

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
