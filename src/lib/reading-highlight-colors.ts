import type { ReadingHighlightColor } from '../types/book'

export const NOTE_HIGHLIGHT_COLOR: ReadingHighlightColor = 'violet'

export const QUICK_HIGHLIGHT_COLOR_OPTIONS = [
  { value: 'yellow', labelKey: 'reader.assets.colorYellow' },
  { value: 'orange', labelKey: 'reader.assets.colorOrange' },
  { value: 'lime', labelKey: 'reader.assets.colorLime' },
  { value: 'green', labelKey: 'reader.assets.colorGreen' },
  { value: 'cyan', labelKey: 'reader.assets.colorCyan' },
  { value: 'blue', labelKey: 'reader.assets.colorBlue' },
  { value: 'rose', labelKey: 'reader.assets.colorRose' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightColor
  labelKey: string
}>

export const HIGHLIGHT_COLOR_OPTIONS = [
  ...QUICK_HIGHLIGHT_COLOR_OPTIONS,
  { value: NOTE_HIGHLIGHT_COLOR, labelKey: 'reader.assets.colorPurple' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightColor
  labelKey: string
}>
