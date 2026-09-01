import { Minus, Moon, Plus, Sun } from 'lucide-react'

export type ReaderTheme = 'paper' | 'light' | 'night'
export type ReaderFlow = 'chapter' | 'continuous' | 'paginated'

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
