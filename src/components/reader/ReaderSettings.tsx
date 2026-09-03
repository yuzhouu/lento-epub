import {
  ChevronDown,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { LanguageSwitcher } from '../LanguageSwitcher'

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
  labelKey: string
  icon: typeof Sun
}> = [
  { value: 'paper', labelKey: 'reader.settingsPanel.paper', icon: Sun },
  { value: 'light', labelKey: 'reader.settingsPanel.light', icon: Sun },
  { value: 'night', labelKey: 'reader.settingsPanel.night', icon: Moon },
]

const FONT_OPTIONS: Array<{
  value: ReaderFontPreset
  labelKey: string
  previewClassName: string
}> = [
  { value: 'publisher', labelKey: 'reader.settingsPanel.publisher', previewClassName: 'font-publisher' },
  { value: 'serif', labelKey: 'reader.settingsPanel.serif', previewClassName: 'font-serif' },
  { value: 'sans', labelKey: 'reader.settingsPanel.sans', previewClassName: 'font-sans' },
  { value: 'kai', labelKey: 'reader.settingsPanel.kai', previewClassName: 'font-kai' },
]

const LINE_HEIGHT_OPTIONS: Array<{
  value: ReaderLineHeight
  labelKey: string
}> = [
  { value: 'compact', labelKey: 'reader.settingsPanel.compact' },
  { value: 'standard', labelKey: 'reader.settingsPanel.standard' },
  { value: 'relaxed', labelKey: 'reader.settingsPanel.relaxed' },
]

const READER_WIDTH_OPTIONS: Array<{
  value: ReaderWidth
  labelKey: string
}> = [
  { value: 'narrow', labelKey: 'reader.settingsPanel.narrow' },
  { value: 'standard', labelKey: 'reader.settingsPanel.standard' },
  { value: 'wide', labelKey: 'reader.settingsPanel.wide' },
]

const PARAGRAPH_STYLE_OPTIONS: Array<{
  value: ReaderParagraphStyle
  labelKey: string
}> = [
  { value: 'publisher', labelKey: 'reader.settingsPanel.publisher' },
  { value: 'indent', labelKey: 'reader.settingsPanel.indent' },
  { value: 'spaced', labelKey: 'reader.settingsPanel.spaced' },
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
  const { t } = useTranslation()
  const selectedLocalFont = font.source === 'local' ? font.family : ''
  const localFonts = useLocalFonts(selectedLocalFont)

  return (
    <div className="settings-popover" role="dialog" aria-label={t('reader.settings')}>
      <section
        className="settings-section"
        aria-labelledby="text-settings-heading"
      >
        <h2 className="settings-section-heading" id="text-settings-heading">
          {t('reader.settingsPanel.text')}
        </h2>
        <div className="settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.fontSize')}</span>
          <div className="font-stepper">
            <button
              type="button"
              aria-label={t('reader.settingsPanel.decreaseFont')}
              onClick={() => onFontSizeChange(Math.max(15, fontSize - 1))}
            >
              <Minus size={16} strokeWidth={1.6} />
            </button>
            <output>{fontSize}</output>
            <button
              type="button"
              aria-label={t('reader.settingsPanel.increaseFont')}
              onClick={() => onFontSizeChange(Math.min(26, fontSize + 1))}
            >
              <Plus size={16} strokeWidth={1.6} />
            </button>
          </div>
        </div>
        <div className="settings-row font-settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.font')}</span>
          <div className="font-options" aria-label={t('reader.settingsPanel.bodyFont')}>
            {FONT_OPTIONS.map(({ value, labelKey, previewClassName }) => (
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
                {t(labelKey)}
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
                  ? t('reader.settingsPanel.discoveringFonts')
                  : t('reader.settingsPanel.discoverFonts')}
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
                          : t('reader.settingsPanel.chooseSystemFont')}
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
                          t('reader.settingsPanel.chooseFontHint')
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
                    aria-label={t('reader.settingsPanel.rediscoverFonts')}
                    aria-describedby="local-font-status"
                    title={t('reader.settingsPanel.rediscoverFonts')}
                    onClick={() => void localFonts.discover()}
                  >
                    <RefreshCw aria-hidden="true" size={14} strokeWidth={1.6} />
                    <span>
                      <strong>{t('reader.settingsPanel.fontCount', { count: localFonts.options.length })}</strong>
                      <small>{localFonts.isDiscovering ? t('common.loading') : t('common.refreshing')}</small>
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
          {t('reader.settingsPanel.typography')}
        </h2>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.lineHeight')}</span>
          <div className="setting-options" aria-label={t('reader.settingsPanel.lineHeight')}>
            {LINE_HEIGHT_OPTIONS.map(({ value, labelKey }) => (
              <button
                className={lineHeight === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={lineHeight === value}
                onClick={() => onLineHeightChange(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.width')}</span>
          <div className="setting-options" aria-label={t('reader.settingsPanel.width')}>
            {READER_WIDTH_OPTIONS.map(({ value, labelKey }) => (
              <button
                className={readerWidth === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={readerWidth === value}
                onClick={() => onReaderWidthChange(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row typography-settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.paragraph')}</span>
          <div
            className="setting-options paragraph-style-options"
            aria-label={t('reader.settingsPanel.paragraph')}
          >
            {PARAGRAPH_STYLE_OPTIONS.map(({ value, labelKey }) => (
              <button
                className={paragraphStyle === value ? 'is-selected' : undefined}
                key={value}
                type="button"
                aria-pressed={paragraphStyle === value}
                onClick={() => onParagraphStyleChange(value)}
              >
                {t(labelKey)}
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
          {t('reader.settingsPanel.preferences')}
        </h2>
        <div className="settings-row reading-flow-settings-row">
          <span className="settings-field-label">{t('reader.settingsPanel.flow')}</span>
          <div className="flow-options" aria-label={t('reader.settingsPanel.flow')}>
            <button
              className={flow === 'chapter' ? 'is-selected' : undefined}
              type="button"
              aria-label={t('reader.settingsPanel.chapterLabel')}
              aria-pressed={flow === 'chapter'}
              onClick={() => onFlowChange('chapter')}
            >
              {t('reader.settingsPanel.chapter')}
            </button>
            <button
              className={flow === 'continuous' ? 'is-selected' : undefined}
              type="button"
              aria-label={t('reader.settingsPanel.continuousLabel')}
              aria-pressed={flow === 'continuous'}
              onClick={() => onFlowChange('continuous')}
            >
              {t('reader.settingsPanel.continuous')}
            </button>
            <button
              className={flow === 'paginated' ? 'is-selected' : undefined}
              type="button"
              aria-label={t('reader.settingsPanel.paginatedLabel')}
              aria-pressed={flow === 'paginated'}
              onClick={() => onFlowChange('paginated')}
            >
              {t('reader.settingsPanel.paginated')}
            </button>
          </div>
        </div>
        {flow === 'paginated' ? (
          <div className="pagination-settings" aria-label={t('reader.settingsPanel.paginationSettings')}>
            <button
              className="preference-toggle"
              type="button"
              role="switch"
              aria-checked={keyboardPagination}
              onClick={() => onKeyboardPaginationChange(!keyboardPagination)}
            >
              <span>
                <span className="preference-toggle-label">{t('reader.settingsPanel.keyboardPagination')}</span>
                <small>{t('reader.settingsPanel.keyboardPaginationHint')}</small>
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
                <span className="preference-toggle-label">{t('reader.settingsPanel.clickPagination')}</span>
                <small>{t('reader.settingsPanel.clickPaginationHint')}</small>
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
          {t('reader.settingsPanel.appearance')}
        </h2>
        <div className="theme-options" aria-label={t('reader.settingsPanel.theme')}>
          {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
            <button
              className={theme === value ? 'is-selected' : undefined}
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => onThemeChange(value)}
            >
              <Icon size={16} strokeWidth={1.5} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section settings-language-section">
        <h2 className="settings-section-heading">{t('language.label')}</h2>
        <LanguageSwitcher />
      </section>
    </div>
  )
}
