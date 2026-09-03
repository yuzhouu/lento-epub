import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
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
  onSelect,
  onShowSearch,
  onShowToc,
  onUpdateHighlight,
}: ReadingAssetsPanelProps) {
  const { t } = useTranslation()
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
      aria-label={t('reader.assets.panelLabel', { title: book.title })}
    >
      <div className="toc-header">
        <strong>{t('common.brandShort')}</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">{t('reader.assets.close')}</span>
        </button>
      </div>

      <div className="navigation-tabs has-three" aria-label={t('reader.navigation')}>
        <button type="button" onClick={onShowToc}>
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.toc')}
        </button>
        <button type="button" onClick={onShowSearch}>
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.search')}
        </button>
        <button className="is-active" type="button" aria-current="page">
          <NotebookPen aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.excerpts')}
        </button>
      </div>

      <div className="reading-assets-content">
        {errorMessage ? (
          <p className="reading-assets-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="reading-assets-filters" aria-label={t('reader.assets.filters')}>
          <button
            className={filter === 'all' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('all')}
          >
            {t('common.all')} {assets.length}
          </button>
          <button
            className={filter === 'bookmark' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('bookmark')}
          >
            {t('reader.assets.bookmarks', { count: bookmarkCount })}
          </button>
          <button
            className={filter === 'highlight' ? 'is-active' : ''}
            type="button"
            onClick={() => setFilter('highlight')}
          >
            {t('reader.assets.highlights', { count: highlightCount })}
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
            <strong>{assets.length === 0 ? t('reader.assets.empty') : t('reader.assets.filteredEmpty')}</strong>
            <span>{t('reader.assets.emptyHint')}</span>
          </div>
        )}
      </div>

      <div className="toc-footer">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          {t('common.backToLibrary')}
        </button>
      </div>
    </aside>
  )
}
