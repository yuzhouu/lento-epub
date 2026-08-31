import { X } from 'lucide-react'
import type { TocItem } from '../../types/book'

interface TocPanelProps {
  items: TocItem[]
  currentHref?: string
  onClose: () => void
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
          style={{ paddingInlineStart: `${28 + depth * 16}px` }}
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
  onClose,
  onSelect,
}: TocPanelProps) {
  return (
    <aside className="toc-panel" aria-label="目录">
      <div className="toc-header">
        <h2>目录</h2>
        <button className="icon-button" type="button" onClick={onClose}>
          <X aria-hidden="true" size={20} strokeWidth={1.5} />
          <span className="visually-hidden">关闭目录</span>
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
    </aside>
  )
}
