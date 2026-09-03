import { describe, expect, it } from 'vitest'
import i18n, { SUPPORTED_LANGUAGES, TRANSLATIONS } from './i18n'

function flattenKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'object' && child !== null
      ? flattenKeys(child as object, path)
      : [path]
  })
}

function hasPath(value: object, path: string): boolean {
  let current: unknown = value
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return false
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string'
}

describe('i18n catalogs', () => {
  it('defines every Chinese source key in all supported languages', () => {
    const requiredKeys = flattenKeys(TRANSLATIONS['zh-CN'])

    for (const { code } of SUPPORTED_LANGUAGES) {
      for (const key of requiredKeys) {
        expect(hasPath(TRANSLATIONS[code], key), `${code} is missing ${key}`).toBe(true)
      }
    }
  })

  it('resolves representative translated and interpolated copy', () => {
    expect(i18n.getFixedT('ja')('library.emptyTitle')).toBe('本棚はまだ空です')
    expect(
      i18n.getFixedT('es')('library.deleted', { title: 'Don Quijote' }),
    ).toContain('Don Quijote')
  })
})
