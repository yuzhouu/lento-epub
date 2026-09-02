import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Download,
  Highlighter,
  List,
  NotebookPen,
  PanelLeftClose,
  Search,
  Trash2,
} from 'lucide-react'
import type {
  BookRecord,
  ReadingAsset,
  ReadingHighlight,
  ReadingHighlightColor,
  ReadingHighlightStyle,
} from '../../types/book'
import type { ReadingAssetExportFormat } from '../../lib/reading-asset-export'
import { HIGHLIGHT_COLOR_OPTIONS } from '../../lib/reading-highlight-colors'
import {
  DEFAULT_READING_HIGHLIGHT_STYLE,
  READING_HIGHLIGHT_STYLE_OPTIONS,
} from '../../lib/reading-highlight-styles'
import { ReadingHighlightStyleIcon } from './ReadingHighlightStyleIcon'

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

function formatAssetDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
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
  const [editingId, setEditingId] = useState<string>()
  const [noteDraft, setNoteDraft] = useState('')
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
      if (await onDelete(asset)) {
        if (editingId === asset.id) setEditingId(undefined)
      }
    } finally {
      setBusyAssetId(undefined)
    }
  }

  async function handleSaveNote(highlight: ReadingHighlight) {
    if (busyAssetId) return
    setBusyAssetId(highlight.id)
    try {
      if (await onUpdateHighlight(highlight, { note: noteDraft })) {
        setEditingId(undefined)
      }
    } finally {
      setBusyAssetId(undefined)
    }
  }

  async function handleColorChange(
    highlight: ReadingHighlight,
    color: ReadingHighlightColor,
  ) {
    if (busyAssetId || highlight.color === color) return
    setBusyAssetId(highlight.id)
    try {
      await onUpdateHighlight(highlight, { color })
    } finally {
      setBusyAssetId(undefined)
    }
  }

  async function handleLineStyleChange(
    highlight: ReadingHighlight,
    lineStyle: ReadingHighlightStyle,
  ) {
    if (
      busyAssetId ||
      (highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE) === lineStyle
    ) {
      return
    }
    setBusyAssetId(highlight.id)
    try {
      await onUpdateHighlight(highlight, { lineStyle })
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
              <li
                key={asset.id}
                ref={
                  activeAssetId === asset.id ? activeAssetElementRef : undefined
                }
                className={activeAssetId === asset.id ? 'is-active' : ''}
              >
                <article className={`reading-asset is-${asset.kind}`}>
                  <button
                    className="reading-asset-location"
                    type="button"
                    onClick={() => onSelect(asset)}
                  >
                    {asset.kind === 'bookmark' ? (
                      <Bookmark
                        aria-hidden="true"
                        size={15}
                        strokeWidth={1.6}
                        fill="currentColor"
                      />
                    ) : (
                      <Highlighter aria-hidden="true" size={15} strokeWidth={1.6} />
                    )}
                    <span>{asset.chapterLabel || '未标注章节'}</span>
                    <time dateTime={new Date(asset.createdAt).toISOString()}>
                      {formatAssetDate(asset.createdAt)}
                    </time>
                  </button>

                  {asset.kind === 'highlight' ? (
                    <>
                      <button
                        className="reading-highlight-text"
                        type="button"
                        onClick={() => onSelect(asset)}
                      >
                        {asset.text}
                      </button>
                      <div className="reading-highlight-colors" aria-label="划线颜色">
                        {HIGHLIGHT_COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            className={`highlight-color is-${color.value}`}
                            type="button"
                            aria-label={color.label}
                            aria-pressed={asset.color === color.value}
                            disabled={busyAssetId === asset.id}
                            onClick={() =>
                              void handleColorChange(asset, color.value)
                            }
                          />
                        ))}
                      </div>
                      <div
                        className="highlight-style-options"
                        aria-label="划线样式"
                      >
                        {READING_HIGHLIGHT_STYLE_OPTIONS.map((style) => (
                          <button
                            key={style.value}
                            className="highlight-style-option"
                            type="button"
                            aria-label={style.label}
                            aria-pressed={
                              (asset.lineStyle ??
                                DEFAULT_READING_HIGHLIGHT_STYLE) === style.value
                            }
                            disabled={busyAssetId === asset.id}
                            onClick={() =>
                              void handleLineStyleChange(asset, style.value)
                            }
                          >
                            <ReadingHighlightStyleIcon style={style.value} />
                          </button>
                        ))}
                      </div>
                      {editingId === asset.id ? (
                        <div className="reading-note-editor">
                          <textarea
                            value={noteDraft}
                            maxLength={2000}
                            rows={4}
                            autoFocus
                            placeholder="写下这段文字带来的想法…"
                            onChange={(event) => setNoteDraft(event.target.value)}
                          />
                          <div>
                            <button
                              type="button"
                              onClick={() => setEditingId(undefined)}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              disabled={busyAssetId === asset.id}
                              onClick={() => void handleSaveNote(asset)}
                            >
                              保存批注
                            </button>
                          </div>
                        </div>
                      ) : asset.note ? (
                        <button
                          className="reading-note"
                          type="button"
                          onClick={() => {
                            setEditingId(asset.id)
                            setNoteDraft(asset.note ?? '')
                          }}
                        >
                          <span>批注</span>
                          {asset.note}
                        </button>
                      ) : (
                        <button
                          className="reading-note-add"
                          type="button"
                          onClick={() => {
                            setEditingId(asset.id)
                            setNoteDraft('')
                          }}
                        >
                          添加批注
                        </button>
                      )}
                    </>
                  ) : null}

                  <button
                    className="reading-asset-delete"
                    type="button"
                    aria-label={`删除${asset.kind === 'bookmark' ? '书签' : '划线'}`}
                    disabled={busyAssetId === asset.id}
                    onClick={() => void handleDelete(asset)}
                  >
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.65} />
                  </button>
                </article>
              </li>
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
