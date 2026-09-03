import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { zhCN } from './locales/zh-CN'
import { en } from './locales/en'
import { ja } from './locales/ja'
import { ru } from './locales/ru'
import { fr } from './locales/fr'
import { es } from './locales/es'

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const TRANSLATIONS = {
  'zh-CN': zhCN,
  en,
  ja,
  ru,
  fr,
  es,
} as const

const LANGUAGE_STORAGE_KEY = 'lento:language:v1'
const supportedLanguageCodes = new Set<AppLanguage>(
  SUPPORTED_LANGUAGES.map(({ code }) => code),
)

function normalizeLanguage(language: string | null | undefined): AppLanguage | undefined {
  if (!language) return undefined
  if (language.toLowerCase().startsWith('zh')) return 'zh-CN'
  const baseLanguage = language.toLowerCase().split('-')[0] as AppLanguage
  return supportedLanguageCodes.has(baseLanguage) ? baseLanguage : undefined
}

function getInitialLanguage(): AppLanguage {
  try {
    const storedLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
    if (storedLanguage) return storedLanguage
  } catch {
    // Browser language detection still works when local storage is unavailable.
  }

  if (typeof navigator !== 'undefined') {
    for (const language of navigator.languages ?? [navigator.language]) {
      const normalizedLanguage = normalizeLanguage(language)
      if (normalizedLanguage) return normalizedLanguage
    }
  }
  return 'zh-CN'
}

function synchronizeDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = normalizeLanguage(language) ?? 'zh-CN'
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: TRANSLATIONS['zh-CN'] },
    en: { translation: TRANSLATIONS.en },
    ja: { translation: TRANSLATIONS.ja },
    ru: { translation: TRANSLATIONS.ru },
    fr: { translation: TRANSLATIONS.fr },
    es: { translation: TRANSLATIONS.es },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh-CN',
  supportedLngs: SUPPORTED_LANGUAGES.map(({ code }) => code),
  load: 'currentOnly',
  interpolation: { escapeValue: false },
})

synchronizeDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
i18n.on('languageChanged', synchronizeDocumentLanguage)

export async function changeLanguage(language: AppLanguage): Promise<void> {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // The in-memory language can still change without persistence.
  }
  await i18n.changeLanguage(language)
}

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ?? 'zh-CN'
}

export default i18n
