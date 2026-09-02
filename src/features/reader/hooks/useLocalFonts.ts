import { useCallback, useState } from 'react'
import {
  discoverLocalFontFamilies,
  getCachedLocalFontFamilies,
  LocalFontDiscoveryUnsupportedError,
} from '../model/local-font-service'

export function useLocalFonts(selectedFont: string) {
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
          ? `已发现 ${nextFamilies.length} 个系统字体。`
          : '没有发现可用的系统字体。',
      )
    } catch (error) {
      setMessage(
        error instanceof LocalFontDiscoveryUnsupportedError
          ? '当前浏览器不支持发现系统字体，请使用桌面版 Chrome 或 Edge。'
          : error instanceof DOMException &&
              (error.name === 'NotAllowedError' || error.name === 'SecurityError')
            ? '未获得系统字体访问权限，仍可使用预设字体。'
            : '系统字体读取失败，请稍后重试。',
      )
    } finally {
      setIsDiscovering(false)
    }
  }, [])

  return {
    options,
    isDiscovering,
    isPickerOpen,
    message,
    discover,
    setIsPickerOpen,
  }
}
