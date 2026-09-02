import { getReaderFontFamily, type ReaderFont } from '../../../lib/reader-font'
import type {
  ReaderFlow,
  ReaderLineHeight,
  ReaderParagraphStyle,
  ReaderTheme,
  ReaderWidth,
} from '../model/reader-preferences'
import type { EpubRendition } from './epub-types'

const THEME_COLORS: Record<
  ReaderTheme,
  { background: string; color: string }
> = {
  paper: { background: '#f5f2eb', color: '#1e2925' },
  light: { background: '#ffffff', color: '#18201d' },
  night: { background: '#202421', color: '#e6e1d5' },
}

const READER_LINE_HEIGHTS: Record<ReaderLineHeight, number> = {
  compact: 1.72,
  standard: 2.05,
  relaxed: 2.4,
}

export const READER_WIDTHS: Record<ReaderWidth, number> = {
  narrow: 620,
  standard: 760,
  wide: 940,
}

const PAGINATED_HORIZONTAL_PADDING: Record<ReaderWidth, string> = {
  narrow: 'clamp(34px, 9vw, 76px)',
  standard: 'clamp(22px, 5vw, 46px)',
  wide: 'clamp(14px, 3vw, 28px)',
}

export interface EpubThemeOptions {
  theme: ReaderTheme
  font: ReaderFont
  fontSize: number
  flow: ReaderFlow
  lineHeight: ReaderLineHeight
  readerWidth: ReaderWidth
  paragraphStyle: ReaderParagraphStyle
}

export function registerReaderTheme(
  rendition: EpubRendition,
  {
    theme,
    font,
    fontSize,
    flow,
    lineHeight,
    readerWidth,
    paragraphStyle,
  }: EpubThemeOptions,
) {
  const colors = THEME_COLORS[theme]
  const fontFamily = getReaderFontFamily(font)
  const lineHeightValue = READER_LINE_HEIGHTS[lineHeight]
  const paragraphRules =
    paragraphStyle === 'indent'
      ? {
          'text-indent': '2em !important',
          'margin-block': '0.35em !important',
        }
      : paragraphStyle === 'spaced'
        ? {
            'text-indent': '0 !important',
            'margin-block': '0 1em !important',
          }
        : {}

  const contents = rendition.getContents() as unknown as Array<{
    document?: Document
  }>
  contents.forEach((content) => {
    content.document?.getElementById('epubjs-inserted-css-lento')?.remove()
  })

  rendition.themes.register('lento', {
    body: {
      color: `${colors.color} !important`,
      background: `${colors.background} !important`,
      'line-height': `${lineHeightValue} !important`,
      padding:
        flow === 'paginated'
          ? `0 ${PAGINATED_HORIZONTAL_PADDING[readerWidth]} !important`
          : '0 min(4vw, 30px) !important',
      ...(flow !== 'paginated'
        ? {
            width: `min(${READER_WIDTHS[readerWidth]}px, calc(100% - 8px)) !important`,
            margin: '0 auto !important',
            'box-sizing': 'border-box !important',
          }
        : {}),
    },
    ...(fontFamily
      ? {
          'body, p, div, span, li, td, th, blockquote, h1, h2, h3, h4, h5, h6': {
            'font-family': `${fontFamily} !important`,
          },
        }
      : {}),
    p: {
      'font-size': `${fontSize}px !important`,
      'line-height': `${lineHeightValue} !important`,
      ...paragraphRules,
    },
    h1: {
      'font-size': `${Math.round(fontSize * 1.75)}px !important`,
      'font-weight': '500 !important',
      'line-height': '1.45 !important',
    },
    h2: {
      'font-size': `${Math.round(fontSize * 1.4)}px !important`,
      'font-weight': '500 !important',
      'line-height': '1.5 !important',
    },
    a: { color: '#315d4b !important' },
    img: { 'max-width': '100% !important' },
  })
  rendition.themes.select('lento')
}
