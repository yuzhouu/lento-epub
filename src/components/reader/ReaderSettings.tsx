import {
  ChevronDown,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from 'lucide-react'
import {
  getReadableLocalFontName,
  getReaderFontFamily,
  type ReaderFont,
  type ReaderFontPreset,
} from '../../lib/reader-font'
import type {
  ReaderFlow,
  ReaderLineHeight,
  ReaderParagraphStyle,
  ReaderTheme,
  ReaderWidth,
} from '../../features/reader/model/reader-preferences'
import {
  LocalFontPicker,
  LOCAL_FONT_PREVIEW_EN,
  LOCAL_FONT_PREVIEW_ZH,
} from '../../features/reader/components/LocalFontPicker'
import { useLocalFonts } from '../../features/reader/hooks/useLocalFonts'

export type {
  ReaderFlow,
  ReaderLineHeight,
  ReaderParagraphStyle,
  ReaderTheme,
  ReaderWidth,
} from '../../features/reader/model/reader-preferences'

interface ReaderSettingsProps {
  font: ReaderFont
  fontSize: number
  flow: ReaderFlow
  lineHeight: ReaderLineHeight
  readerWidth: ReaderWidth
  paragraphStyle: ReaderParagraphStyle
  keyboardPagination: boolean
  clickPagination: boolean
  theme: ReaderTheme
  onFontChange: (font: ReaderFont) => void
  onFontSizeChange: (size: number) => void
  onFlowChange: (flow: ReaderFlow) => void
  onLineHeightChange: (lineHeight: ReaderLineHeight) => void
  onReaderWidthChange: (readerWidth: ReaderWidth) => void
  onParagraphStyleChange: (paragraphStyle: ReaderParagraphStyle) => void
  onKeyboardPaginationChange: (enabled: boolean) => void
  onClickPaginationChange: (enabled: boolean) => void
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

const LINE_HEIGHT_OPTIONS: Array<{
  value: ReaderLineHeight
  label: string
}> = [
  { value: 'compact', label: '紧凑' },
  { value: 'standard', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

const READER_WIDTH_OPTIONS: Array<{
  value: ReaderWidth
  label: string
}> = [
  { value: 'narrow', label: '窄' },
  { value: 'standard', label: '标准' },
  { value: 'wide', label: '宽' },
]

const PARAGRAPH_STYLE_OPTIONS: Array<{
  value: ReaderParagraphStyle
  label: string
}> = [
  { value: 'publisher', label: '原书' },
  { value: 'indent', label: '缩进' },
  { value: 'spaced', label: '段间留白' },
]

export function ReaderSettings({
  font,
  fontSize,
  flow,
  lineHeight,
  readerWidth,
  paragraphStyle,
  keyboardPagination,
  clickPagination,
  theme,
  onFontChange,
  onFontSizeChange,
  onFlowChange,
  onLineHeightChange,
  onReaderWidthChange,
  onParagraphStyleChange,
  onKeyboardPaginationChange,
  onClickPaginationChange,
  onThemeChange,
}: ReaderSettingsProps) {
  const selectedLocalFont = font.source === 'local' ? font.family : ''
  const localFonts = useLocalFonts(selectedLocalFont)

  return (
    <div className="settings-popover" role="dialog" aria-label="阅读设置">
      <section
        className="settings-section"
        aria-labelledby="text-settings-heading"
      >
        <h2 className="settings-section-heading" id="text-settings-heading">
          文字
        </h2>
        <div className="settings-row">
          <span className="settings-field-label">字号</span>
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
          <span className="settings-field-label">字体</span>
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
            {localFonts.options.length === 0 ? (
              <button
                className="discover-fonts-button"
                type="button"
                disabled={localFonts.isDiscovering}
                aria-describedby="local-font-status"
                onClick={() => void localFonts.discover()}
              >
                {localFonts.isDiscovering
                  ? '正在读取系统字体…'
                  : '发现系统字体'}
              </button>
            ) : (
              <>
                <div className="local-font-summary">
                  <button
                    className="local-font-picker-toggle"
                    type="button"
                    aria-expanded={localFonts.isPickerOpen}
                    onClick={() => localFonts.setIsPickerOpen((open) => !open)}
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
                      className={localFonts.isPickerOpen ? 'is-open' : undefined}
                      size={16}
                      strokeWidth={1.6}
                    />
                  </button>
                  <button
                    className="local-font-refresh-button"
                    type="button"
                    disabled={localFonts.isDiscovering}
                    aria-label="重新发现系统字体"
                    aria-describedby="local-font-status"
                    title="重新发现系统字体"
                    onClick={() => void localFonts.discover()}
                  >
                    <RefreshCw aria-hidden="true" size={14} strokeWidth={1.6} />
                    <span>
                      <strong>{localFonts.options.length} 种</strong>
                      <small>{localFonts.isDiscovering ? '读取中' : '刷新'}</small>
                    </span>
                  </button>
                </div>
                {localFonts.isPickerOpen ? (
                  <LocalFontPicker
                    families={localFonts.options}
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
              {localFonts.message}
            </span>
          </div>
        </div>
      </section>
      <section
        className="settings-section typography-settings"
        aria-labelledby="typography-settings-heading"
      >
        <h2
          className="settings-section-heading"
          id="typography-settings-heading"
        >
          排版
        </h2>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">行距</span>
          <div className="setting-options" aria-label="正文行距">
            {LINE_HEIGHT_OPTIONS.map(({ value, label }) => (
              <button
                className={lineHeight === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={lineHeight === value}
                onClick={() => onLineHeightChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">阅读宽度</span>
          <div className="setting-options" aria-label="正文阅读宽度">
            {READER_WIDTH_OPTIONS.map(({ value, label }) => (
              <button
                className={readerWidth === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={readerWidth === value}
                onClick={() => onReaderWidthChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">段落</span>
          <div
            className="setting-options paragraph-style-options"
            aria-label="正文段落样式"
          >
            {PARAGRAPH_STYLE_OPTIONS.map(({ value, label }) => (
              <button
                className={paragraphStyle === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={paragraphStyle === value}
                onClick={() => onParagraphStyleChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section
        className="settings-section reading-preferences"
        aria-labelledby="reading-preferences-heading"
      >
        <h2
          className="settings-section-heading"
          id="reading-preferences-heading"
        >
          阅读偏好
        </h2>
        <div className="settings-row reading-flow-settings-row">
          <span className="settings-field-label">阅读方式</span>
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
        {flow === 'paginated' ? (
          <div className="pagination-settings" aria-label="分页设置">
            <button
              className="preference-toggle"
              type="button"
              role="switch"
              aria-checked={keyboardPagination}
              onClick={() => onKeyboardPaginationChange(!keyboardPagination)}
            >
              <span>
                <span className="preference-toggle-label">方向键翻页</span>
                <small>使用键盘左右方向键</small>
              </span>
              <span className="toggle-track" aria-hidden="true">
                <span />
              </span>
            </button>
            <button
              className="preference-toggle"
              type="button"
              role="switch"
              aria-checked={clickPagination}
              onClick={() => onClickPaginationChange(!clickPagination)}
            >
              <span>
                <span className="preference-toggle-label">点击两侧翻页</span>
                <small>点击正文左右边缘区域</small>
              </span>
              <span className="toggle-track" aria-hidden="true">
                <span />
              </span>
            </button>
          </div>
        ) : null}
      </section>
      <section
        className="settings-section"
        aria-labelledby="appearance-settings-heading"
      >
        <h2
          className="settings-section-heading"
          id="appearance-settings-heading"
        >
          外观
        </h2>
        <div className="theme-options" aria-label="背景主题">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              className={theme === value ? 'is-selected' : undefined}
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => onThemeChange(value)}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
