import { TriangleAlert } from 'lucide-react'
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

export function LibraryStorageSummary({
  bookCount,
  visibleBookCount,
  hasActiveFilters,
  storageInfo,
}: LibraryStorageSummaryProps) {
  const usagePercent =
    storageInfo?.usedBytes !== undefined && storageInfo.quotaBytes
      ? Math.min(100, (storageInfo.usedBytes / storageInfo.quotaBytes) * 100)
      : undefined

  return (
    <>
      <div className="section-heading">
        <div className="library-heading-copy">
          <h2 id="library-title">我的书架</h2>
          <span>
            {hasActiveFilters
              ? `${visibleBookCount} / ${bookCount} 本书`
              : `${bookCount} 本书`}
          </span>
          <div
            className={`library-storage-overview${
              storageInfo?.isLow ? ' is-low' : ''
            }`}
            role="status"
            title="包含 EPUB 文件、阅读数据与离线应用缓存"
          >
            {storageInfo ? (
              storageInfo.quotaBytes !== undefined ? (
                <>
                  <span>总占用</span>
                  <span className="library-storage-value">
                    {formatBytes(storageInfo.usedBytes ?? storageInfo.bookBytes)} /{' '}
                    {formatBytes(storageInfo.quotaBytes)}
                  </span>
                  <span className="library-storage-percent">
                    {formatUsagePercent(usagePercent ?? 0)}
                  </span>
                </>
              ) : (
                <span>书籍占用 {formatBytes(storageInfo.bookBytes)}</span>
              )
            ) : (
              <span>正在统计空间…</span>
            )}
          </div>
        </div>
      </div>

      {storageInfo?.isLow ? (
        <div className="library-storage-warning" role="alert">
          <TriangleAlert aria-hidden="true" size={19} strokeWidth={1.7} />
          <div>
            <strong>浏览器存储空间不足</strong>
            <span>
              {storageInfo.availableBytes !== undefined
                ? `仅剩约 ${formatBytes(storageInfo.availableBytes)}，继续添加或恢复书籍可能失败。`
                : '继续添加或恢复书籍可能失败。'}
              请先删除不再需要的书，或释放设备空间。
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}
