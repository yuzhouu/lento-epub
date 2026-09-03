import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LibraryStorageInfo } from '../../../data/indexed-db/storage-capacity'
import { formatBytes } from '../../../lib/format-bytes'

function formatUsagePercent(value: number): string {
  if (value === 0) return '0%'
  if (value < 0.1) return '<0.1%'
  if (value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

interface LibraryStorageSummaryProps {
  bookCount: number
  visibleBookCount: number
  hasActiveFilters: boolean
  storageInfo?: LibraryStorageInfo
}

interface LibraryStorageDisplayProps {
  storageInfo?: LibraryStorageInfo
}

export function LibraryStorageOverview({
  storageInfo,
}: LibraryStorageDisplayProps) {
  const { t } = useTranslation()
  const usagePercent =
    storageInfo?.usedBytes !== undefined && storageInfo.quotaBytes
      ? Math.min(100, (storageInfo.usedBytes / storageInfo.quotaBytes) * 100)
      : undefined

  return (
    <div
      className={`library-storage-overview${
        storageInfo?.isLow ? ' is-low' : ''
      }`}
      role="status"
      title={t('library.storage.title')}
    >
      {storageInfo ? (
        storageInfo.quotaBytes !== undefined ? (
          <>
            <span>{t('library.storage.total')}</span>
            <span className="library-storage-value">
              {formatBytes(storageInfo.usedBytes ?? storageInfo.bookBytes)} /{' '}
              {formatBytes(storageInfo.quotaBytes)}
            </span>
            <span className="library-storage-percent">
              {formatUsagePercent(usagePercent ?? 0)}
            </span>
          </>
        ) : (
          <span>
            {t('library.storage.books', {
              size: formatBytes(storageInfo.bookBytes),
            })}
          </span>
        )
      ) : (
        <span>{t('library.storage.calculating')}</span>
      )}
    </div>
  )
}

export function LibraryStorageWarning({
  storageInfo,
}: LibraryStorageDisplayProps) {
  const { t } = useTranslation()

  if (!storageInfo?.isLow) return null

  return (
    <div className="library-storage-warning" role="alert">
      <TriangleAlert aria-hidden="true" size={19} strokeWidth={1.7} />
      <div>
        <strong>{t('library.storage.lowTitle')}</strong>
        <span>
          {storageInfo.availableBytes !== undefined
            ? t('library.storage.lowRemaining', {
                size: formatBytes(storageInfo.availableBytes),
              })
            : t('library.storage.lowUnknown')}{' '}
          {t('library.storage.lowAction')}
        </span>
      </div>
    </div>
  )
}

export function LibraryStorageSummary({
  bookCount,
  visibleBookCount,
  hasActiveFilters,
  storageInfo,
}: LibraryStorageSummaryProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className="section-heading">
        <div className="library-heading-copy">
          <h2 id="library-title">{t('library.heading')}</h2>
          <span>
            {hasActiveFilters
              ? t('library.storage.filteredCount', { visible: visibleBookCount, total: bookCount })
              : t('common.books', { count: bookCount })}
          </span>
          <LibraryStorageOverview storageInfo={storageInfo} />
        </div>
      </div>

      <LibraryStorageWarning storageInfo={storageInfo} />
    </>
  )
}
