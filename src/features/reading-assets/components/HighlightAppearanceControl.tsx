import { HIGHLIGHT_COLOR_OPTIONS } from '../../../lib/reading-highlight-colors'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_READING_HIGHLIGHT_STYLE,
  READING_HIGHLIGHT_STYLE_OPTIONS,
} from '../../../lib/reading-highlight-styles'
import type {
  ReadingHighlightColor,
  ReadingHighlightStyle,
} from '../../../types/book'
import { ReadingHighlightStyleIcon } from '../../../components/reader/ReadingHighlightStyleIcon'

interface HighlightAppearanceControlProps {
  color?: ReadingHighlightColor
  lineStyle?: ReadingHighlightStyle
  colors?: ReadonlyArray<{
    value: ReadingHighlightColor
    labelKey: string
  }>
  colorClassName?: string
  disabled?: boolean
  onColorChange: (color: ReadingHighlightColor) => void
  onLineStyleChange: (lineStyle: ReadingHighlightStyle) => void
}

export function HighlightAppearanceControl({
  color,
  lineStyle = DEFAULT_READING_HIGHLIGHT_STYLE,
  colors = HIGHLIGHT_COLOR_OPTIONS,
  colorClassName = 'selection-editor-colors',
  disabled = false,
  onColorChange,
  onLineStyleChange,
}: HighlightAppearanceControlProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className={colorClassName} aria-label={t('reader.assets.colors')}>
        {colors.map((option) => (
          <button
            key={option.value}
            className={`highlight-color is-${option.value}`}
            type="button"
            aria-label={t(option.labelKey)}
            aria-pressed={color === option.value}
            disabled={disabled}
            onClick={() => onColorChange(option.value)}
          />
        ))}
      </div>
      <div className="highlight-style-options" aria-label={t('reader.assets.styles')}>
        {READING_HIGHLIGHT_STYLE_OPTIONS.map((style) => (
          <button
            key={style.value}
            className="highlight-style-option"
            type="button"
            aria-label={t(style.labelKey)}
            aria-pressed={lineStyle === style.value}
            disabled={disabled}
            onClick={() => onLineStyleChange(style.value)}
          >
            <ReadingHighlightStyleIcon style={style.value} />
          </button>
        ))}
      </div>
    </>
  )
}
