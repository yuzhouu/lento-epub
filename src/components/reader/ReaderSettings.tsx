import { Minus, Moon, Plus, Sun } from 'lucide-react'

export type ReaderTheme = 'paper' | 'light' | 'night'

interface ReaderSettingsProps {
  fontSize: number
  theme: ReaderTheme
  onFontSizeChange: (size: number) => void
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
  theme,
  onFontSizeChange,
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
