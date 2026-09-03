import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  discoverLocalFontFamilies,
  getCachedLocalFontFamilies,
  LocalFontDiscoveryUnsupportedError,
} from '../model/local-font-service'

export function useLocalFonts(selectedFont: string) {
  const { t } = useTranslation()
  const [families, setFamilies] = useState(getCachedLocalFontFamilies)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [message, setMessage] = useState<string>()
  const options =
    selectedFont && !families.includes(selectedFont)
      ? [selectedFont, ...families]
      : families

  const discover = useCallback(async () => {
    setIsDiscovering(true)
    setMessage(undefined)
    try {
      const nextFamilies = await discoverLocalFontFamilies()
      setFamilies(nextFamilies)
      setIsPickerOpen(nextFamilies.length > 0)
      setMessage(
        nextFamilies.length > 0
          ? t('errors.localFontsFound', { count: nextFamilies.length })
          : t('errors.noLocalFonts'),
      )
    } catch (error) {
      setMessage(
        error instanceof LocalFontDiscoveryUnsupportedError
          ? t('errors.localFontsUnsupported')
          : error instanceof DOMException &&
              (error.name === 'NotAllowedError' || error.name === 'SecurityError')
            ? t('errors.localFontsDenied')
            : t('errors.localFontsFailed'),
      )
    } finally {
      setIsDiscovering(false)
    }
  }, [t])

  return {
    options,
    isDiscovering,
    isPickerOpen,
    message,
    discover,
    setIsPickerOpen,
  }
}
