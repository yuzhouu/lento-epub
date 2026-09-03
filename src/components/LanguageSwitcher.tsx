import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  changeLanguage,
  getCurrentLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from '../i18n'

interface LanguageSwitcherProps {
  compact?: boolean
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { t } = useTranslation()

  return (
    <label className={`language-switcher${compact ? ' is-compact' : ''}`}>
      <Languages aria-hidden="true" size={16} strokeWidth={1.7} />
      <span className={compact ? 'visually-hidden' : undefined}>
        {t('language.label')}
      </span>
      <select
        aria-label={t('language.select')}
        value={getCurrentLanguage()}
        onChange={(event) =>
          void changeLanguage(event.target.value as AppLanguage)
        }
      >
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
