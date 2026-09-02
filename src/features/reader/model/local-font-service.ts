import { isValidLocalFontFamily } from '../../../lib/reader-font'

interface LocalFontData {
  family: string
}

interface LocalFontAccessWindow extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}

let cachedLocalFontFamilies: string[] | undefined

export class LocalFontDiscoveryUnsupportedError extends Error {}

export function getCachedLocalFontFamilies(): string[] {
  return cachedLocalFontFamilies ? [...cachedLocalFontFamilies] : []
}

function getLocalFontAccess(): LocalFontAccessWindow['queryLocalFonts'] {
  return (window as LocalFontAccessWindow).queryLocalFonts
}

function canUseChromeFontSettings(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id) &&
    typeof chrome.fontSettings?.getFontList === 'function'
  )
}

async function queryChromeExtensionFonts(): Promise<string[]> {
  const fonts = await chrome.fontSettings.getFontList()
  return fonts.map((font) => font.displayName)
}

export async function discoverLocalFontFamilies(): Promise<string[]> {
  const queryLocalFonts = getLocalFontAccess()
  const canQueryExtensionFonts = canUseChromeFontSettings()
  if (!queryLocalFonts && !canQueryExtensionFonts) {
    throw new LocalFontDiscoveryUnsupportedError()
  }

  let discoveredFamilies = queryLocalFonts
    ? (await queryLocalFonts.call(window)).map((font) => font.family)
    : []
  if (discoveredFamilies.length === 0 && canQueryExtensionFonts) {
    discoveredFamilies = await queryChromeExtensionFonts()
  }

  cachedLocalFontFamilies = [
    ...new Set(discoveredFamilies.map((family) => family.trim())),
  ]
    .filter(isValidLocalFontFamily)
    .sort((left, right) =>
      left.localeCompare(right, 'zh-CN', {
        numeric: true,
        sensitivity: 'base',
      }),
    )
  return [...cachedLocalFontFamilies]
}
