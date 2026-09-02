import type { ReadingHighlightStyle } from '../types/book'

export const DEFAULT_READING_HIGHLIGHT_STYLE: ReadingHighlightStyle = 'single'

export const READING_HIGHLIGHT_STYLE_OPTIONS = [
  { value: 'single', label: '单线' },
  { value: 'double', label: '双线' },
  { value: 'wave', label: '波浪线' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightStyle
  label: string
}>
