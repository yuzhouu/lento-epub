import type { ReadingHighlightColor } from '../types/book'

export const NOTE_HIGHLIGHT_COLOR: ReadingHighlightColor = 'violet'

export const QUICK_HIGHLIGHT_COLOR_OPTIONS = [
  { value: 'yellow', label: '荧光黄' },
  { value: 'orange', label: '杏橙' },
  { value: 'lime', label: '青柠' },
  { value: 'green', label: '薄荷绿' },
  { value: 'cyan', label: '晴蓝' },
  { value: 'blue', label: '矢车蓝' },
  { value: 'rose', label: '珊瑚粉' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightColor
  label: string
}>

export const HIGHLIGHT_COLOR_OPTIONS = [
  ...QUICK_HIGHLIGHT_COLOR_OPTIONS,
  { value: NOTE_HIGHLIGHT_COLOR, label: '批注紫' },
] as const satisfies ReadonlyArray<{
  value: ReadingHighlightColor
  label: string
}>
