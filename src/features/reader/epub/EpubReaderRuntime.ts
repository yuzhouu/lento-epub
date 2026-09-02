import ePub from 'epubjs'
import { sanitizeEpubFontSources } from '../../../lib/epub-font-sanitizer'
import type { ReaderFlow } from '../model/reader-preferences'
import { registerReaderTheme, type EpubThemeOptions } from './epub-theme'
import type { EpubBook, EpubRendition } from './epub-types'

interface CreateEpubReaderRuntimeOptions {
  data: ArrayBuffer
  viewer: HTMLElement
  flow: ReaderFlow
  theme: EpubThemeOptions
  isCancelled: () => boolean
}

export class EpubReaderRuntime {
  readonly book: EpubBook
  readonly rendition: EpubRendition
  private readonly releaseSanitizedFontStyles: () => void

  private constructor(
    book: EpubBook,
    rendition: EpubRendition,
    releaseSanitizedFontStyles: () => void,
  ) {
    this.book = book
    this.rendition = rendition
    this.releaseSanitizedFontStyles = releaseSanitizedFontStyles
  }

  static async create({
    data,
    viewer,
    flow,
    theme,
    isCancelled,
  }: CreateEpubReaderRuntimeOptions): Promise<EpubReaderRuntime | undefined> {
    const book = ePub(data.slice(0))
    const releaseFontStyles = await sanitizeEpubFontSources(
      book as unknown as Parameters<typeof sanitizeEpubFontSources>[0],
    )
    if (isCancelled()) {
      releaseFontStyles()
      book.destroy()
      return undefined
    }

    const rendition = book.renderTo(viewer, {
      width: '100%',
      height: '100%',
      manager: flow === 'continuous' ? 'continuous' : 'default',
      flow: flow === 'paginated' ? 'paginated' : 'scrolled',
      spread: 'none',
    })
    registerReaderTheme(rendition, theme)
    return new EpubReaderRuntime(book, rendition, releaseFontStyles)
  }

  destroy() {
    this.rendition.destroy()
    this.book.destroy()
    this.releaseSanitizedFontStyles()
  }
}
