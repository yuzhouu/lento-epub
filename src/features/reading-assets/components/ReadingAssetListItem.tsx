import { useState, type Ref } from 'react'
import { Bookmark, Highlighter, Trash2 } from 'lucide-react'
import type {
  ReadingAsset,
  ReadingHighlight,
  ReadingHighlightColor,
  ReadingHighlightStyle,
} from '../../../types/book'
import { HighlightAppearanceControl } from './HighlightAppearanceControl'

interface ReadingAssetListItemProps {
  asset: ReadingAsset
  active: boolean
  busy: boolean
  elementRef?: Ref<HTMLLIElement>
  onDelete: () => void
  onSelect: () => void
  onUpdateHighlight: (
    patch: Partial<
      Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note'>
    >,
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

export function ReadingAssetListItem({
  asset,
  active,
  busy,
  elementRef,
  onDelete,
  onSelect,
  onUpdateHighlight,
}: ReadingAssetListItemProps) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  function beginEditingNote() {
    setNoteDraft(asset.kind === 'highlight' ? (asset.note ?? '') : '')
    setEditingNote(true)
  }

  async function saveNote() {
    if (asset.kind !== 'highlight') return
    if (await onUpdateHighlight({ note: noteDraft })) setEditingNote(false)
  }

  return (
    <li ref={elementRef} className={active ? 'is-active' : ''}>
      <article className={`reading-asset is-${asset.kind}`}>
        <button
          className="reading-asset-location"
          type="button"
          onClick={onSelect}
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
              onClick={onSelect}
            >
              {asset.text}
            </button>
            <HighlightAppearanceControl
              color={asset.color}
              lineStyle={asset.lineStyle}
              colorClassName="reading-highlight-colors"
              disabled={busy}
              onColorChange={(color: ReadingHighlightColor) =>
                void onUpdateHighlight({ color })
              }
              onLineStyleChange={(lineStyle: ReadingHighlightStyle) =>
                void onUpdateHighlight({ lineStyle })
              }
            />
            {editingNote ? (
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
                  <button type="button" onClick={() => setEditingNote(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveNote()}
                  >
                    保存批注
                  </button>
                </div>
              </div>
            ) : asset.note ? (
              <button
                className="reading-note"
                type="button"
                onClick={beginEditingNote}
              >
                <span>批注</span>
                {asset.note}
              </button>
            ) : (
              <button
                className="reading-note-add"
                type="button"
                onClick={beginEditingNote}
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
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={1.65} />
        </button>
      </article>
    </li>
  )
}
