export type ReaderFontPreset = 'publisher' | 'serif' | 'sans' | 'kai'

export type ReaderFont =
  | { source: 'preset'; preset: ReaderFontPreset }
  | { source: 'local'; family: string }

export const DEFAULT_READER_FONT: ReaderFont = {
  source: 'preset',
  preset: 'serif',
}

const READER_FONT_FAMILIES: Record<
  Exclude<ReaderFontPreset, 'publisher'>,
  string
> = {
  serif: '"Songti SC", "STSong", "Noto Serif CJK SC", Georgia, serif',
  sans: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", serif',
}

const LOCAL_FONT_READABLE_NAMES: Record<string, string> = {
  'dengxian': '等线',
  'fangsong': '中易仿宋',
  'heiti sc': '黑体·简体',
  'hiragino sans gb': '冬青黑体·简体',
  'kaiti': '中易楷体',
  'kaiti sc': '楷体·简体',
  'kaiti tc': '楷体·繁体',
  'lxgw wenkai': '霞鹜文楷',
  'microsoft yahei': '微软雅黑',
  'noto sans cjk sc': '思源黑体·简体',
  'noto serif cjk sc': '思源宋体·简体',
  'nsimsun': '新宋体',
  'pingfang sc': '苹方·简体',
  'pingfang tc': '苹方·繁体',
  'simhei': '中易黑体',
  'simsun': '中易宋体',
  'songti sc': '宋体·简体',
  'songti tc': '宋体·繁体',
  'source han sans sc': '思源黑体·简体',
  'source han serif sc': '思源宋体·简体',
  'stfangsong': '华文仿宋',
  'stheiti': '华文黑体',
  'stkaiti': '华文楷体',
  'stsong': '华文宋体',
}

export function isReaderFontPreset(value: unknown): value is ReaderFontPreset {
  return (
    value === 'publisher' ||
    value === 'serif' ||
    value === 'sans' ||
    value === 'kai'
  )
}

export function isValidLocalFontFamily(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  )
}

function quoteCssFontFamily(family: string): string {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function getReaderFontFamily(font: ReaderFont): string | undefined {
  if (font.source === 'local') return quoteCssFontFamily(font.family)
  if (font.preset === 'publisher') return undefined
  return READER_FONT_FAMILIES[font.preset]
}

export function getReadableLocalFontName(family: string): string | undefined {
  return LOCAL_FONT_READABLE_NAMES[family.toLocaleLowerCase('en-US')]
}

export function parseStoredReaderFont(
  savedFont: string | null,
  legacyFont: string | null,
): ReaderFont {
  if (savedFont) {
    try {
      const parsedFont = JSON.parse(savedFont) as unknown
      if (
        typeof parsedFont === 'object' &&
        parsedFont !== null &&
        'source' in parsedFont
      ) {
        if (
          parsedFont.source === 'preset' &&
          'preset' in parsedFont &&
          isReaderFontPreset(parsedFont.preset)
        ) {
          return { source: 'preset', preset: parsedFont.preset }
        }
        if (
          parsedFont.source === 'local' &&
          'family' in parsedFont &&
          isValidLocalFontFamily(parsedFont.family)
        ) {
          return { source: 'local', family: parsedFont.family }
        }
      }
    } catch {
      // Ignore malformed v2 data and fall back to the legacy selection.
    }
  }

  return isReaderFontPreset(legacyFont)
    ? { source: 'preset', preset: legacyFont }
    : DEFAULT_READER_FONT
}
