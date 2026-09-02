import { useCallback, useState } from 'react'
import type { ReaderFont } from '../../../lib/reader-font'
import {
  persistReaderPreference,
  readReaderPreferences,
  type ReaderFlow,
  type ReaderLineHeight,
  type ReaderParagraphStyle,
  type ReaderPreferences,
  type ReaderTheme,
  type ReaderWidth,
} from '../model/reader-preferences'

export interface ReaderPreferenceController extends ReaderPreferences {
  setFont: (font: ReaderFont) => void
  setFontSize: (fontSize: number) => void
  setFlow: (flow: ReaderFlow) => void
  setLineHeight: (lineHeight: ReaderLineHeight) => void
  setReaderWidth: (readerWidth: ReaderWidth) => void
  setParagraphStyle: (paragraphStyle: ReaderParagraphStyle) => void
  setKeyboardPagination: (enabled: boolean) => void
  setClickPagination: (enabled: boolean) => void
  setTheme: (theme: ReaderTheme) => void
}

export function useReaderPreferences(): ReaderPreferenceController {
  const [preferences, setPreferences] = useState(readReaderPreferences)

  const update = useCallback(
    <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => {
      persistReaderPreference(key, value)
      setPreferences((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  return {
    ...preferences,
    setFont: useCallback((value) => update('font', value), [update]),
    setFontSize: useCallback((value) => update('fontSize', value), [update]),
    setFlow: useCallback((value) => update('flow', value), [update]),
    setLineHeight: useCallback((value) => update('lineHeight', value), [update]),
    setReaderWidth: useCallback((value) => update('readerWidth', value), [update]),
    setParagraphStyle: useCallback(
      (value) => update('paragraphStyle', value),
      [update],
    ),
    setKeyboardPagination: useCallback(
      (value) => update('keyboardPagination', value),
      [update],
    ),
    setClickPagination: useCallback(
      (value) => update('clickPagination', value),
      [update],
    ),
    setTheme: useCallback((value) => update('theme', value), [update]),
  }
}
