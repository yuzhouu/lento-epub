import { Minus, Moon, Plus, Sun } from 'lucide-react'

export type ReaderTheme = 'paper' | 'light' | 'night'
export type ReaderFlow = 'scrolled' | 'paginated'

interface ReaderSettingsProps {
  fontSize: number
  flow: ReaderFlow
  theme: ReaderTheme
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

export function ReaderSettings({
  fontSize,
  flow,
  theme,
  onFontSizeChange,
  onFlowChange,
  onThemeChange,
}: ReaderSettingsProps) {
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
      <div className="settings-row flow-settings-row">
        <span>翻页</span>
        <div className="flow-options" aria-label="翻页方式">
          <button
            className={flow === 'scrolled' ? 'is-selected' : undefined}
            type="button"
            aria-pressed={flow === 'scrolled'}
            onClick={() => onFlowChange('scrolled')}
          >
            滚动
          </button>
          <button
            className={flow === 'paginated' ? 'is-selected' : undefined}
            type="button"
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
