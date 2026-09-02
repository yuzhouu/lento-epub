import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Download,
  List,
  NotebookPen,
  PanelLeftClose,
  Search,
} from 'lucide-react'
import type {
  BookRecord,
  ReadingAsset,
  ReadingHighlight,
} from '../../types/book'
import type { ReadingAssetExportFormat } from '../../lib/reading-asset-export'
import { ReadingAssetListItem } from '../../features/reading-assets/components/ReadingAssetListItem'

interface ReadingAssetsPanelProps {
  book: BookRecord
  assets: ReadingAsset[]
  activeAssetId?: string
  activeAssetFocusVersion: number
  errorMessage?: string
  onBack: () => void
  onClose: () => void
  onDelete: (asset: ReadingAsset) => Promise<boolean>
  onExport: (format: ReadingAssetExportFormat) => void
  onSelect: (asset: ReadingAsset) => void
  onShowSearch: () => void
  onShowToc: () => void
  onUpdateHighlight: (
    asset: ReadingHighlight,
    patch: Partial<Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note'>>,
  ) => Promise<boolean>
}

export function ReadingAssetsPanel({
  book,
  assets,
  activeAssetId,
  activeAssetFocusVersion,
  errorMessage,
  onBack,
  onClose,
  onDelete,
  onExport,
  onSelect,
  onShowSearch,
  onShowToc,
  onUpdateHighlight,
}: ReadingAssetsPanelProps) {
  const [filter, setFilter] = useState<'all' | ReadingAsset['kind']>('all')
  const [busyAssetId, setBusyAssetId] = useState<string>()
  const activeAssetElementRef = useRef<HTMLLIElement>(null)
  const lastFocusVersionRef = useRef(0)
  const pendingFocusVersionRef = useRef<number | undefined>(undefined)
  const visibleAssets =
    filter === 'all'
      ? assets
      : assets.filter((asset) => asset.kind === filter)
  const bookmarkCount = assets.filter((asset) => asset.kind === 'bookmark').length
  const highlightCount = assets.length - bookmarkCount
  const activeAssetKind = assets.find(
    (asset) => asset.id === activeAssetId,
  )?.kind

  useEffect(() => {
    if (activeAssetFocusVersion !== lastFocusVersionRef.current) {
      lastFocusVersionRef.current = activeAssetFocusVersion
      pendingFocusVersionRef.current = activeAssetFocusVersion
    }
    if (
      !activeAssetId ||
      !activeAssetKind ||
      pendingFocusVersionRef.current !== activeAssetFocusVersion
    ) {
      return
    }
    if (filter !== 'all' && filter !== activeAssetKind) {
      setFilter(activeAssetKind)
      return
    }

    pendingFocusVersionRef.current = undefined
    const frame = requestAnimationFrame(() => {
      activeAssetElementRef.current?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeAssetFocusVersion, activeAssetId, activeAssetKind, filter])

  async function handleDelete(asset: ReadingAsset) {
    if (busyAssetId) return
    setBusyAssetId(asset.id)
    try {
      await onDelete(asset)
    } finally {
      setBusyAssetId(undefined)
    }
  }

  async function handleUpdateHighlight(
    highlight: ReadingHighlight,
    patch: Partial<Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note'>>,
  ): Promise<boolean> {
    if (busyAssetId) return false
    setBusyAssetId(highlight.id)
    try {
      return await onUpdateHighlight(highlight, patch)
    } finally {
      setBusyAssetId(undefined)
    }
  }

  return (
    <aside
      className="toc-panel reading-assets-panel"
      aria-label={`《${book.title}》的书签、划线和笔记`}
    >
      <div className="toc-header">
        <strong>卷舍</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">关闭书摘</span>
        </button>
      </div>

      <div className="navigation-tabs has-three" aria-label="书内导航">
        <button type="button" onClick={onShowToc}>
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          目录
        </button>
        <button type="button" onClick={onShowSearch}>
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          搜索
        </button>
        <button className="is-active" type="button" aria-current="page">
          <NotebookPen aria-hidden="true" size={15} strokeWidth={1.7} />
          书摘
        </button>
      </div>

      <div className="reading-assets-content">
        <header className="reading-assets-heading">
          <div>
            <span>本书阅读资产</span>
            <strong>{assets.length} 条记录</strong>
          </div>
          <div className="reading-assets-export" aria-label="导出阅读记录">
            <button
              type="button"
              disabled={assets.length === 0}
              onClick={() => onExport('markdown')}
            >
              <Download aria-hidden="true" size={14} strokeWidth={1.7} />
              Markdown
            </button>
            <button
              type="button"
              disabled={assets.length === 0}
              onClick={() => onExport('text')}
            >
              纯文本
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="reading-assets-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="reading-assets-filters" aria-label="筛选阅读记录">
          <button
            className={filter === 'all' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('all')}
          >
            全部 {assets.length}
          </button>
          <button
            className={filter === 'bookmark' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('bookmark')}
          >
            书签 {bookmarkCount}
          </button>
          <button
            className={filter === 'highlight' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('highlight')}
          >
            划线 {highlightCount}
          </button>
        </div>

        {visibleAssets.length > 0 ? (
          <ol className="reading-assets-list">
            {visibleAssets.map((asset) => (
              <ReadingAssetListItem
                key={asset.id}
                asset={asset}
                active={activeAssetId === asset.id}
                busy={busyAssetId === asset.id}
                elementRef={
                  activeAssetId === asset.id
                    ? activeAssetElementRef
                    : undefined
                }
                onDelete={() => void handleDelete(asset)}
                onSelect={() => onSelect(asset)}
                onUpdateHighlight={(patch) =>
                  asset.kind === 'highlight'
                    ? handleUpdateHighlight(asset, patch)
                    : Promise.resolve(false)
                }
              />
            ))}
          </ol>
        ) : (
          <div className="reading-assets-empty">
            <NotebookPen aria-hidden="true" size={24} strokeWidth={1.35} />
            <strong>{assets.length === 0 ? '还没有留下阅读记录' : '没有这一类记录'}</strong>
            <span>在正文中选中文字即可划线和批注。</span>
          </div>
        )}
      </div>

      <div className="toc-footer">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          返回书架
        </button>
      </div>
    </aside>
  )
}
