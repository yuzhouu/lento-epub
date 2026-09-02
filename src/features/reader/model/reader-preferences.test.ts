import { beforeEach, describe, expect, it } from 'vitest'
import {
  persistReaderPreference,
  readReaderPreferences,
} from './reader-preferences'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('reader preferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  it('uses safe defaults when storage is empty or malformed', () => {
    localStorage.setItem('lento:reader-font-size:v1', '200')
    localStorage.setItem('lento:reader-theme:v1', 'sepia')

    expect(readReaderPreferences()).toMatchObject({
      fontSize: 18,
      flow: 'chapter',
      keyboardPagination: true,
      clickPagination: false,
      theme: 'light',
    })
  })

  it('migrates legacy flow and font selections', () => {
    localStorage.setItem('lento:reader-flow:v1', 'paginated')
    localStorage.setItem('lento:reader-font:v1', 'kai')

    expect(readReaderPreferences()).toMatchObject({
      flow: 'paginated',
      font: { source: 'preset', preset: 'kai' },
    })
  })

  it('persists primitive and structured values under versioned keys', () => {
    persistReaderPreference('theme', 'night')
    persistReaderPreference('font', {
      source: 'local',
      family: 'LXGW WenKai',
    })

    expect(localStorage.getItem('lento:reader-theme:v1')).toBe('night')
    expect(JSON.parse(localStorage.getItem('lento:reader-font:v2') ?? '')).toEqual({
      source: 'local',
      family: 'LXGW WenKai',
    })
  })
})
