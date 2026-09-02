import {
  DEFAULT_READER_FONT,
  parseStoredReaderFont,
  type ReaderFont,
} from '../../../lib/reader-font'

export type ReaderTheme = 'paper' | 'light' | 'night'
export type ReaderFlow = 'chapter' | 'continuous' | 'paginated'
export type ReaderLineHeight = 'compact' | 'standard' | 'relaxed'
export type ReaderWidth = 'narrow' | 'standard' | 'wide'
export type ReaderParagraphStyle = 'publisher' | 'indent' | 'spaced'

export interface ReaderPreferences {
  font: ReaderFont
  fontSize: number
  flow: ReaderFlow
  lineHeight: ReaderLineHeight
  readerWidth: ReaderWidth
  paragraphStyle: ReaderParagraphStyle
  keyboardPagination: boolean
  clickPagination: boolean
  theme: ReaderTheme
}

export const MIN_READER_FONT_SIZE = 15
export const MAX_READER_FONT_SIZE = 26

const DEFAULT_READER_FONT_SIZE = 18
const STORAGE_KEYS = {
  flow: 'lento:reader-flow:v2',
  legacyFlow: 'lento:reader-flow:v1',
  font: 'lento:reader-font:v2',
  legacyFont: 'lento:reader-font:v1',
  fontSize: 'lento:reader-font-size:v1',
  theme: 'lento:reader-theme:v1',
  lineHeight: 'lento:reader-line-height:v1',
  readerWidth: 'lento:reader-width:v1',
  paragraphStyle: 'lento:reader-paragraph-style:v1',
  keyboardPagination: 'lento:keyboard-pagination:v1',
  clickPagination: 'lento:click-pagination:v1',
} as const

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readFont(): ReaderFont {
  return parseStoredReaderFont(
    readStorage(STORAGE_KEYS.font),
    readStorage(STORAGE_KEYS.legacyFont),
  )
}

function readFontSize(): number {
  const value = Number(readStorage(STORAGE_KEYS.fontSize))
  return Number.isInteger(value) &&
    value >= MIN_READER_FONT_SIZE &&
    value <= MAX_READER_FONT_SIZE
    ? value
    : DEFAULT_READER_FONT_SIZE
}

function readFlow(): ReaderFlow {
  const value = readStorage(STORAGE_KEYS.flow)
  if (value === 'chapter' || value === 'continuous' || value === 'paginated') {
    return value
  }
  return readStorage(STORAGE_KEYS.legacyFlow) === 'paginated'
    ? 'paginated'
    : 'chapter'
}

function readEnum<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = readStorage(key)
  return value && values.includes(value as T) ? (value as T) : fallback
}

function readBoolean(key: string, fallback: boolean): boolean {
  const value = readStorage(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function readReaderPreferences(): ReaderPreferences {
  return {
    font: readFont() ?? DEFAULT_READER_FONT,
    fontSize: readFontSize(),
    flow: readFlow(),
    lineHeight: readEnum(
      STORAGE_KEYS.lineHeight,
      ['compact', 'standard', 'relaxed'],
      'standard',
    ),
    readerWidth: readEnum(
      STORAGE_KEYS.readerWidth,
      ['narrow', 'standard', 'wide'],
      'standard',
    ),
    paragraphStyle: readEnum(
      STORAGE_KEYS.paragraphStyle,
      ['publisher', 'indent', 'spaced'],
      'publisher',
    ),
    keyboardPagination: readBoolean(STORAGE_KEYS.keyboardPagination, true),
    clickPagination: readBoolean(STORAGE_KEYS.clickPagination, false),
    theme: readEnum(
      STORAGE_KEYS.theme,
      ['paper', 'light', 'night'],
      'light',
    ),
  }
}

export function persistReaderPreference<K extends keyof ReaderPreferences>(
  key: K,
  value: ReaderPreferences[K],
): void {
  try {
    const serialized = key === 'font' ? JSON.stringify(value) : String(value)
    localStorage.setItem(STORAGE_KEYS[key], serialized)
  } catch {
    // Preferences remain active for this session when storage is unavailable.
  }
}
