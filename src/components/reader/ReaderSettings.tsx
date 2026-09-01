import { useDeferredValue, useState } from 'react'
import {
  ChevronDown,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
} from 'lucide-react'
import {
  getReadableLocalFontName,
  getReaderFontFamily,
  isValidLocalFontFamily,
  type ReaderFont,
  type ReaderFontPreset,
} from '../../lib/reader-font'

export type ReaderTheme = 'paper' | 'light' | 'night'
export type ReaderFlow = 'chapter' | 'continuous' | 'paginated'

interface ReaderSettingsProps {
  font: ReaderFont
  fontSize: number
  flow: ReaderFlow
  theme: ReaderTheme
  onFontChange: (font: ReaderFont) => void
  onFontSizeChange: (size: number) => void
  onFlowChange: (flow: ReaderFlow) => void
  onThemeChange: (theme: ReaderTheme) => void
}

const THEME_OPTIONS: Array<{
  value: ReaderTheme
  label: string
  icon: typeof Sun
}> = [
  { value: 'paper', label: '纸张', icon: Sun },
  { value: 'light', label: '明亮', icon: Sun },
  { value: 'night', label: '夜间', icon: Moon },
]

const FONT_OPTIONS: Array<{
  value: ReaderFontPreset
  label: string
  previewClassName: string
}> = [
  { value: 'publisher', label: '原书', previewClassName: 'font-publisher' },
  { value: 'serif', label: '宋体', previewClassName: 'font-serif' },
  { value: 'sans', label: '黑体', previewClassName: 'font-sans' },
  { value: 'kai', label: '楷体', previewClassName: 'font-kai' },
]

const LOCAL_FONT_PAGE_SIZE = 60
const LOCAL_FONT_PREVIEW_ZH = '春风翻过书页'
const LOCAL_FONT_PREVIEW_EN = 'The quick brown fox'

interface LocalFontData {
  family: string
}

interface LocalFontAccessWindow extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}

let cachedLocalFontFamilies: string[] | undefined

function getLocalFontAccess(): LocalFontAccessWindow['queryLocalFonts'] {
  return (window as LocalFontAccessWindow).queryLocalFonts
}

function canUseChromeFontSettings(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id) &&
    typeof chrome.permissions?.request === 'function'
  )
}

async function queryChromeExtensionFonts(): Promise<string[]> {
  const granted = await chrome.permissions.request({
    permissions: ['fontSettings'],
  })
  if (!granted) throw new DOMException('Permission denied', 'NotAllowedError')
  if (typeof chrome.fontSettings?.getFontList !== 'function') return []

  const fonts = await chrome.fontSettings.getFontList()
  return fonts.map((font) => font.displayName)
}

interface LocalFontPickerProps {
  families: string[]
  selectedFont: string
  onSelect: (family: string) => void
}

function LocalFontPicker({
  families,
  selectedFont,
  onSelect,
}: LocalFontPickerProps) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(LOCAL_FONT_PAGE_SIZE)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const matchingFonts = deferredQuery
    ? families.filter((family) => {
        const readableName = getReadableLocalFontName(family)
        return (
          family.toLocaleLowerCase().includes(deferredQuery) ||
          readableName?.includes(deferredQuery)
        )
      })
    : families
  const visibleFonts = matchingFonts.slice(0, visibleCount)

  return (
    <div className="local-font-picker">
      <label className="local-font-search">
        <Search aria-hidden="true" size={15} strokeWidth={1.6} />
        <span className="visually-hidden">搜索系统字体</span>
        <input
          type="search"
          value={query}
          placeholder="搜索字体名称"
          onChange={(event) => {
            setQuery(event.target.value)
            setVisibleCount(LOCAL_FONT_PAGE_SIZE)
          }}
        />
      </label>
      <div
        className="local-font-list"
        role="listbox"
        aria-label="系统字体样张"
      >
        {visibleFonts.length > 0 ? (
          visibleFonts.map((family) => {
            const readableName = getReadableLocalFontName(family)
            return (
              <button
                className={
                  selectedFont === family
                    ? 'local-font-choice is-selected'
                    : 'local-font-choice'
                }
                key={family}
                type="button"
                role="option"
                aria-selected={selectedFont === family}
                onClick={() => onSelect(family)}
              >
                <span
                  className="local-font-preview"
                  style={{
                    fontFamily: getReaderFontFamily({
                      source: 'local',
                      family,
                    }),
                  }}
                >
                  <span lang="zh-CN">{LOCAL_FONT_PREVIEW_ZH}</span>
                  {' · '}
                  <span lang="en">{LOCAL_FONT_PREVIEW_EN}</span>
                </span>
                <span className="local-font-name">
                  {readableName ?? family}
                </span>
                {readableName ? (
                  <span className="local-font-technical-name">{family}</span>
                ) : null}
              </button>
            )
          })
        ) : (
          <span className="local-font-empty">没有匹配的字体</span>
        )}
      </div>
      <div className="local-font-list-footer">
        <span>
          已显示 {visibleFonts.length} / {matchingFonts.length}
        </span>
        {visibleFonts.length < matchingFonts.length ? (
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) => count + LOCAL_FONT_PAGE_SIZE)
            }
          >
            继续显示
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ReaderSettings({
  font,
  fontSize,
  flow,
  theme,
  onFontChange,
  onFontSizeChange,
  onFlowChange,
  onThemeChange,
}: ReaderSettingsProps) {
  const [localFontFamilies, setLocalFontFamilies] = useState<string[]>(() =>
    cachedLocalFontFamilies ? [...cachedLocalFontFamilies] : [],
  )
  const [isDiscoveringFonts, setIsDiscoveringFonts] = useState(false)
  const [fontPickerOpen, setFontPickerOpen] = useState(false)
  const [fontDiscoveryMessage, setFontDiscoveryMessage] = useState<string>()
  const selectedLocalFont = font.source === 'local' ? font.family : ''
  const localFontOptions =
    selectedLocalFont && !localFontFamilies.includes(selectedLocalFont)
      ? [selectedLocalFont, ...localFontFamilies]
      : localFontFamilies

  async function discoverLocalFonts() {
    const queryLocalFonts = getLocalFontAccess()
    const canQueryExtensionFonts = canUseChromeFontSettings()
    if (!queryLocalFonts && !canQueryExtensionFonts) {
      setFontDiscoveryMessage(
        '当前浏览器不支持发现系统字体，请使用桌面版 Chrome 或 Edge。',
      )
      return
    }

    setIsDiscoveringFonts(true)
    setFontDiscoveryMessage(undefined)
    try {
      let discoveredFamilies = queryLocalFonts
        ? (await queryLocalFonts.call(window)).map((font) => font.family)
        : []
      if (discoveredFamilies.length === 0 && canQueryExtensionFonts) {
        discoveredFamilies = await queryChromeExtensionFonts()
      }
      const families = [
        ...new Set(discoveredFamilies.map((family) => family.trim())),
      ]
        .filter(isValidLocalFontFamily)
        .sort((left, right) =>
          left.localeCompare(right, 'zh-CN', {
            numeric: true,
            sensitivity: 'base',
          }),
        )
      cachedLocalFontFamilies = families
      setLocalFontFamilies(families)
      setFontPickerOpen(families.length > 0)
      setFontDiscoveryMessage(
        families.length > 0
          ? `已发现 ${families.length} 个系统字体。`
          : '没有发现可用的系统字体。',
      )
    } catch (error) {
      setFontDiscoveryMessage(
        error instanceof DOMException &&
          (error.name === 'NotAllowedError' || error.name === 'SecurityError')
          ? '未获得系统字体访问权限，仍可使用预设字体。'
          : '系统字体读取失败，请稍后重试。',
      )
    } finally {
      setIsDiscoveringFonts(false)
    }
  }

  return (
    <div className="settings-popover" role="dialog" aria-label="阅读设置">
      <div className="settings-row">
        <span>字号</span>
        <div className="font-stepper">
          <button
            type="button"
            aria-label="减小字号"
            onClick={() => onFontSizeChange(Math.max(15, fontSize - 1))}
          >
            <Minus size={16} strokeWidth={1.6} />
          </button>
          <output>{fontSize}</output>
          <button
            type="button"
            aria-label="增大字号"
            onClick={() => onFontSizeChange(Math.min(26, fontSize + 1))}
          >
            <Plus size={16} strokeWidth={1.6} />
          </button>
        </div>
      </div>
      <div className="settings-row font-settings-row">
        <span>字体</span>
        <div className="font-options" aria-label="正文字体">
          {FONT_OPTIONS.map(({ value, label, previewClassName }) => (
            <button
              className={`${previewClassName}${
                font.source === 'preset' && font.preset === value
                  ? ' is-selected'
                  : ''
              }`}
              key={value}
              type="button"
              aria-pressed={
                font.source === 'preset' && font.preset === value
              }
              onClick={() =>
                onFontChange({ source: 'preset', preset: value })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="local-font-controls">
          {localFontOptions.length === 0 ? (
            <button
              className="discover-fonts-button"
              type="button"
              disabled={isDiscoveringFonts}
              aria-describedby="local-font-status"
              onClick={() => void discoverLocalFonts()}
            >
              {isDiscoveringFonts
                ? '正在读取系统字体…'
                : '发现系统字体'}
            </button>
          ) : (
            <>
              <div className="local-font-summary">
                <button
                  className="local-font-picker-toggle"
                  type="button"
                  aria-expanded={fontPickerOpen}
                  onClick={() => setFontPickerOpen((open) => !open)}
                >
                  <span>
                    <strong>
                      {selectedLocalFont
                        ? getReadableLocalFontName(selectedLocalFont) ??
                          selectedLocalFont
                        : '选择系统字体'}
                    </strong>
                    <small
                      className={
                        selectedLocalFont
                          ? 'local-font-picker-toggle-preview'
                          : undefined
                      }
                      style={
                        selectedLocalFont
                          ? {
                              fontFamily: getReaderFontFamily({
                                source: 'local',
                                family: selectedLocalFont,
                              }),
                            }
                          : undefined
                      }
                    >
                      {selectedLocalFont ? (
                        <>
                          <span lang="zh-CN">{LOCAL_FONT_PREVIEW_ZH}</span>
                          {' · '}
                          <span lang="en">{LOCAL_FONT_PREVIEW_EN}</span>
                        </>
                      ) : (
                        '查看中英文样张后再选择'
                      )}
                    </small>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={fontPickerOpen ? 'is-open' : undefined}
                    size={16}
                    strokeWidth={1.6}
                  />
                </button>
                <button
                  className="local-font-refresh-button"
                  type="button"
                  disabled={isDiscoveringFonts}
                  aria-label="重新发现系统字体"
                  aria-describedby="local-font-status"
                  title="重新发现系统字体"
                  onClick={() => void discoverLocalFonts()}
                >
                  <RefreshCw aria-hidden="true" size={14} strokeWidth={1.6} />
                  <span>
                    <strong>{localFontOptions.length} 种</strong>
                    <small>{isDiscoveringFonts ? '读取中' : '刷新'}</small>
                  </span>
                </button>
              </div>
              {fontPickerOpen ? (
                <LocalFontPicker
                  families={localFontOptions}
                  selectedFont={selectedLocalFont}
                  onSelect={(family) =>
                    onFontChange({ source: 'local', family })
                  }
                />
              ) : null}
            </>
          )}
          <span
            className="font-discovery-message"
            id="local-font-status"
            role="status"
          >
            {fontDiscoveryMessage}
          </span>
        </div>
      </div>
      <div className="settings-row flow-settings-row">
        <span>阅读方式</span>
        <div className="flow-options" aria-label="阅读方式">
          <button
            className={flow === 'chapter' ? 'is-selected' : undefined}
            type="button"
            aria-label="逐章滚动"
            aria-pressed={flow === 'chapter'}
            onClick={() => onFlowChange('chapter')}
          >
            逐章
          </button>
          <button
            className={flow === 'continuous' ? 'is-selected' : undefined}
            type="button"
            aria-label="连续滚动"
            aria-pressed={flow === 'continuous'}
            onClick={() => onFlowChange('continuous')}
          >
            连续
          </button>
          <button
            className={flow === 'paginated' ? 'is-selected' : undefined}
            type="button"
            aria-label="分页阅读"
            aria-pressed={flow === 'paginated'}
            onClick={() => onFlowChange('paginated')}
          >
            分页
          </button>
        </div>
      </div>
      <div className="theme-options" aria-label="背景主题">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            className={theme === value ? 'is-selected' : undefined}
            key={value}
            type="button"
            onClick={() => onThemeChange(value)}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
