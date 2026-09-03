import { Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <aside
      className="selection-editor"
      role="dialog"
      aria-label={t('reader.assets.editorLabel')}
    >
      <div className="selection-editor-heading">
        <div>
          <span>{t('reader.assets.editorTitle')}</span>
          <strong>{selection.chapterLabel || t('reader.assets.currentChapter')}</strong>
        </div>
        {isExisting ? (
          <button
            className="selection-editor-delete"
            type="button"
            aria-label={t('reader.assets.deleteSelection')}
            disabled={isSaving}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" size={15} strokeWidth={1.65} />
          </button>
        ) : null}
        <button type="button" aria-label={t('reader.assets.closeSelection')} onClick={onDismiss}>
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
        placeholder={t('reader.assets.autosavePlaceholder')}
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
