import type { ReadingHighlightStyle } from '../types/book'

export const DEFAULT_READING_HIGHLIGHT_STYLE: ReadingHighlightStyle = 'single'

export const READING_HIGHLIGHT_STYLE_OPTIONS = [
  { value: 'single', labelKey: 'reader.assets.styleSingle' },
  { value: 'double', labelKey: 'reader.assets.styleDouble' },
  { value: 'wave', labelKey: 'reader.assets.styleWave' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightStyle
  labelKey: string
}>
