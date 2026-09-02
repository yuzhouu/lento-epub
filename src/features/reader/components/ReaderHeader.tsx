import type { RefObject } from 'react'
import {
  Bookmark,
  List,
  NotebookPen,
  PanelLeftOpen,
  Search,
  Settings,
} from 'lucide-react'
import { ReaderSettings } from '../../../components/reader/ReaderSettings'
import type { ReaderPreferenceController } from '../hooks/useReaderPreferences'
import type { ReaderFlow } from '../model/reader-preferences'
import type { NavigationPanel } from '../model/reader-navigation'

interface ReaderHeaderProps {
  title: string
  chapterLabel?: string
  navigationOpen: boolean
  navigationPanel: NavigationPanel
  hasCurrentBookmark: boolean
  canBookmark: boolean
  isSavingBookmark: boolean
  settingsOpen: boolean
  settingsAnchorRef: RefObject<HTMLDivElement | null>
  preferences: ReaderPreferenceController
  onOpenNavigation: () => void
  onNavigationToggle: (panel: NavigationPanel) => void
  onBookmarkToggle: () => void
  onSettingsToggle: () => void
  onFlowChange: (flow: ReaderFlow) => void
}

export function ReaderHeader({
  title,
  chapterLabel,
  navigationOpen,
  navigationPanel,
  hasCurrentBookmark,
  canBookmark,
  isSavingBookmark,
  settingsOpen,
  settingsAnchorRef,
  preferences,
  onOpenNavigation,
  onNavigationToggle,
  onBookmarkToggle,
  onSettingsToggle,
  onFlowChange,
}: ReaderHeaderProps) {
  return (
    <header className="reader-header">
      <div className="reader-context" aria-live="polite">
        {!navigationOpen ? (
          <button
            className="sidebar-toggle"
            type="button"
            onClick={onOpenNavigation}
          >
            <PanelLeftOpen aria-hidden="true" size={19} strokeWidth={1.7} />
            <span className="visually-hidden">打开书内导航</span>
          </button>
        ) : null}
        <strong>{title}</strong>
        <span aria-hidden="true">/</span>
        <span title={chapterLabel}>{chapterLabel || '正在打开…'}</span>
      </div>
      <div className="reader-tools">
        <button
          className="reader-tool-button"
          type="button"
          aria-pressed={navigationOpen && navigationPanel === 'toc'}
          onClick={() => onNavigationToggle('toc')}
        >
          <List aria-hidden="true" size={18} strokeWidth={1.7} />
          <span>目录</span>
        </button>
        <button
          className="reader-tool-button"
          type="button"
          aria-pressed={navigationOpen && navigationPanel === 'search'}
          onClick={() => onNavigationToggle('search')}
        >
          <Search aria-hidden="true" size={18} strokeWidth={1.7} />
          <span>搜索</span>
        </button>
        <button
          className="reader-tool-button"
          type="button"
          aria-pressed={navigationOpen && navigationPanel === 'assets'}
          onClick={() => onNavigationToggle('assets')}
        >
          <NotebookPen aria-hidden="true" size={18} strokeWidth={1.7} />
          <span>书摘</span>
        </button>
        <button
          className="reader-tool-button reader-bookmark-button"
          type="button"
          aria-label={hasCurrentBookmark ? '移除当前页书签' : '为当前页添加书签'}
          aria-pressed={hasCurrentBookmark}
          disabled={!canBookmark || isSavingBookmark}
          onClick={onBookmarkToggle}
        >
          <Bookmark
            aria-hidden="true"
            size={18}
            strokeWidth={1.7}
            fill={hasCurrentBookmark ? 'currentColor' : 'none'}
          />
          <span>{hasCurrentBookmark ? '已加书签' : '当前页书签'}</span>
        </button>
        <div className="settings-anchor" ref={settingsAnchorRef}>
          <button
            className="reader-tool-button"
            type="button"
            aria-expanded={settingsOpen}
            onClick={onSettingsToggle}
          >
            <Settings aria-hidden="true" size={18} strokeWidth={1.7} />
            <span>阅读设置</span>
          </button>
          {settingsOpen ? (
            <ReaderSettings
              font={preferences.font}
              fontSize={preferences.fontSize}
              flow={preferences.flow}
              lineHeight={preferences.lineHeight}
              readerWidth={preferences.readerWidth}
              paragraphStyle={preferences.paragraphStyle}
              keyboardPagination={preferences.keyboardPagination}
              clickPagination={preferences.clickPagination}
              theme={preferences.theme}
              onFontChange={preferences.setFont}
              onFontSizeChange={preferences.setFontSize}
              onFlowChange={onFlowChange}
              onLineHeightChange={preferences.setLineHeight}
              onReaderWidthChange={preferences.setReaderWidth}
              onParagraphStyleChange={preferences.setParagraphStyle}
              onKeyboardPaginationChange={preferences.setKeyboardPagination}
              onClickPaginationChange={preferences.setClickPagination}
              onThemeChange={preferences.setTheme}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
