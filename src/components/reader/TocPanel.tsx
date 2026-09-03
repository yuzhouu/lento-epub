import {
  ArrowLeft,
  List,
  NotebookPen,
  PanelLeftClose,
  Search,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TocItem } from '../../types/book'

interface TocPanelProps {
  items: TocItem[]
  currentHref?: string
  onBack: () => void
  onClose: () => void
  onShowAssets: () => void
  onSearch: () => void
  onSelect: (href: string) => void
}

function TocEntries({
  items,
  currentHref,
  onSelect,
  depth = 0,
}: Pick<TocPanelProps, 'items' | 'currentHref' | 'onSelect'> & {
  depth?: number
}) {
  return items.map((item) => {
    const label = item.label.trim()
    const isCurrent = Boolean(
      currentHref &&
        (currentHref === item.href || currentHref.endsWith(item.href)),
    )

    return (
      <li key={`${depth}-${item.id || item.href}`}>
        <button
          className={isCurrent ? 'toc-item is-current' : 'toc-item'}
          type="button"
          style={{ paddingInlineStart: `${14 + depth * 16}px` }}
          title={label}
          onClick={() => onSelect(item.href)}
        >
          {label}
        </button>
        {item.subitems?.length ? (
          <ul>
            <TocEntries
              items={item.subitems}
              currentHref={currentHref}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </ul>
        ) : null}
      </li>
    )
  })
}

export function TocPanel({
  items,
  currentHref,
  onBack,
  onClose,
  onShowAssets,
  onSearch,
  onSelect,
}: TocPanelProps) {
  const { t } = useTranslation()

  return (
    <aside className="toc-panel" aria-label={t('reader.toc.label')}>
      <div className="toc-header">
        <strong>{t('common.brandShort')}</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">{t('reader.toc.close')}</span>
        </button>
      </div>
      <div className="navigation-tabs has-three" aria-label={t('reader.navigation')}>
        <button className="is-active" type="button" aria-current="page">
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.toc')}
        </button>
        <button type="button" onClick={onSearch}>
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.search')}
        </button>
        <button type="button" onClick={onShowAssets}>
          <NotebookPen aria-hidden="true" size={15} strokeWidth={1.7} />
          {t('common.excerpts')}
        </button>
      </div>
      {items.length ? (
        <nav aria-label={t('reader.toc.chapters')}>
          <ul className="toc-list">
            <TocEntries
              items={items}
              currentHref={currentHref}
              onSelect={onSelect}
            />
          </ul>
        </nav>
      ) : (
        <p className="toc-empty">{t('reader.toc.loading')}</p>
      )}
      <div className="toc-footer">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          {t('common.backToLibrary')}
        </button>
      </div>
    </aside>
  )
}
