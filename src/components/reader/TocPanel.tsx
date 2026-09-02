import {
  ArrowLeft,
  List,
  NotebookPen,
  PanelLeftClose,
  Search,
} from 'lucide-react'
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
          onClick={() => onSelect(item.href)}
        >
          {item.label.trim()}
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
  return (
    <aside className="toc-panel" aria-label="目录">
      <div className="toc-header">
        <strong>卷舍</strong>
        <button className="sidebar-toggle" type="button" onClick={onClose}>
          <PanelLeftClose aria-hidden="true" size={19} strokeWidth={1.7} />
          <span className="visually-hidden">关闭目录</span>
        </button>
      </div>
      <div className="navigation-tabs has-three" aria-label="书内导航">
        <button className="is-active" type="button" aria-current="page">
          <List aria-hidden="true" size={15} strokeWidth={1.7} />
          目录
        </button>
        <button type="button" onClick={onSearch}>
          <Search aria-hidden="true" size={15} strokeWidth={1.7} />
          搜索
        </button>
        <button type="button" onClick={onShowAssets}>
          <NotebookPen aria-hidden="true" size={15} strokeWidth={1.7} />
          书摘
        </button>
      </div>
      {items.length ? (
        <nav aria-label="章节目录">
          <ul className="toc-list">
            <TocEntries
              items={items}
              currentHref={currentHref}
              onSelect={onSelect}
            />
          </ul>
        </nav>
      ) : (
        <p className="toc-empty">正在整理目录…</p>
      )}
      <div className="toc-footer">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
          返回书架
        </button>
      </div>
    </aside>
  )
}
