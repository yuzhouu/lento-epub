import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppButton() {
  const { t } = useTranslation()
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent>()

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleAppInstalled() {
      setInstallPrompt(undefined)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (!installPrompt) return null

  async function handleInstall() {
    const prompt = installPrompt
    if (!prompt) return
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      // The browser can withdraw the install prompt at any time.
    } finally {
      setInstallPrompt(undefined)
    }
  }

  return (
    <button
      className="secondary-button library-utility-button"
      type="button"
      onClick={() => void handleInstall()}
      title={t('library.install.title')}
    >
      <Download aria-hidden="true" size={17} strokeWidth={1.7} />
      <span>{t('library.install.button')}</span>
    </button>
  )
}
