import { Trash2, X } from 'lucide-react'
import { QUICK_HIGHLIGHT_COLOR_OPTIONS } from '../../../lib/reading-highlight-colors'
import type {
  ReadingHighlightColor,
  ReadingHighlightStyle,
} from '../../../types/book'
import { HighlightAppearanceControl } from './HighlightAppearanceControl'

export interface PendingSelection {
  cfi: string
  text: string
  href?: string
  chapterLabel?: string
}

interface SelectionEditorProps {
  selection: PendingSelection
  note: string
  color?: ReadingHighlightColor
  lineStyle: ReadingHighlightStyle
  isSaving: boolean
  isExisting: boolean
  errorMessage?: string
  onDelete: () => void
  onDismiss: () => void
  onNoteChange: (note: string) => void
  onColorChange: (color: ReadingHighlightColor) => void
  onLineStyleChange: (lineStyle: ReadingHighlightStyle) => void
}

export function SelectionEditor({
  selection,
  note,
  color,
  lineStyle,
  isSaving,
  isExisting,
  errorMessage,
  onDelete,
  onDismiss,
  onNoteChange,
  onColorChange,
  onLineStyleChange,
}: SelectionEditorProps) {
  return (
    <aside
      className="selection-editor"
      role="dialog"
      aria-label="为选中文字添加划线和批注"
    >
      <div className="selection-editor-heading">
        <div>
          <span>划线与批注</span>
          <strong>{selection.chapterLabel || '当前章节'}</strong>
        </div>
        {isExisting ? (
          <button
            className="selection-editor-delete"
            type="button"
            aria-label="删除划线和批注"
            disabled={isSaving}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" size={15} strokeWidth={1.65} />
          </button>
        ) : null}
        <button type="button" aria-label="关闭划线与批注" onClick={onDismiss}>
          <X aria-hidden="true" size={16} strokeWidth={1.7} />
        </button>
      </div>
      <blockquote>{selection.text}</blockquote>
      <HighlightAppearanceControl
        color={color}
        lineStyle={lineStyle}
        colors={QUICK_HIGHLIGHT_COLOR_OPTIONS}
        disabled={isSaving}
        onColorChange={onColorChange}
        onLineStyleChange={onLineStyleChange}
      />
      <textarea
        value={note}
        maxLength={2000}
        rows={3}
        placeholder="写下批注，离开后自动保存"
        onChange={(event) => onNoteChange(event.target.value)}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget
          if (
            nextTarget instanceof Element &&
            nextTarget.closest('.selection-editor')
          ) {
            return
          }
          onDismiss()
        }}
      />
      {errorMessage ? (
        <p className="selection-editor-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </aside>
  )
}
