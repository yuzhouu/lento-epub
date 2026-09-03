import {
  ArrowLeft,
  BookMarked,
  BookOpenText,
  ExternalLink,
  HardDriveDownload,
  Library,
  MessageCircleMore,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../LanguageSwitcher'

const FEEDBACK_URL =
  'https://github.com/yuzhouu/lento-epub/issues/new?title=%5B%E5%8F%8D%E9%A6%88%5D%20'

const FEATURES = [
  {
    icon: Library,
    titleKey: 'about.feature1Title',
    descriptionKey: 'about.feature1Body',
  },
  {
    icon: BookOpenText,
    titleKey: 'about.feature2Title',
    descriptionKey: 'about.feature2Body',
  },
  {
    icon: BookMarked,
    titleKey: 'about.feature3Title',
    descriptionKey: 'about.feature3Body',
  },
  {
    icon: HardDriveDownload,
    titleKey: 'about.feature4Title',
    descriptionKey: 'about.feature4Body',
  },
] as const

export function AboutPage() {
  const { t } = useTranslation()

  return (
    <main className="about-page">
      <header className="about-header">
        <a className="about-back-link" href="#/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.7} />
          {t('common.backToLibrary')}
        </a>
        <a className="about-brand" href="#/" aria-label={t('about.homeLabel')}>
          {t('common.brand')}
        </a>
      </header>

      <div className="about-content">
        <section className="about-hero" aria-labelledby="about-title">
          <p className="about-eyebrow">{t('about.eyebrow')}</p>
          <h1 id="about-title">{t('about.title')}</h1>
          <p className="about-intro">{t('about.intro')}</p>
          <p className="about-slogan">{t('common.slogan')}</p>
        </section>

        <section className="about-feature-section" aria-labelledby="features-title">
          <div className="about-section-heading">
            <span>01</span>
            <h2 id="features-title">{t('about.featuresTitle')}</h2>
          </div>
          <div className="about-feature-list">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <article className="about-feature" key={feature.titleKey}>
                  <Icon aria-hidden="true" size={21} strokeWidth={1.45} />
                  <div>
                    <h3>{t(feature.titleKey)}</h3>
                    <p>{t(feature.descriptionKey)}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="about-privacy" aria-labelledby="privacy-title">
          <ShieldCheck aria-hidden="true" size={25} strokeWidth={1.4} />
          <div>
            <p className="about-section-kicker">{t('about.privacyKicker')}</p>
            <h2 id="privacy-title">{t('about.privacyTitle')}</h2>
            <p>{t('about.privacyBody')}</p>
            <a className="about-privacy-link" href="#/privacy">
              {t('about.privacyLink')}
            </a>
          </div>
        </section>

        <section className="about-feedback" aria-labelledby="feedback-title">
          <div className="about-section-heading">
            <span>02</span>
            <h2 id="feedback-title">{t('about.feedbackTitle')}</h2>
          </div>
          <div className="about-feedback-body">
            <div>
              <MessageCircleMore
                aria-hidden="true"
                size={25}
                strokeWidth={1.45}
              />
              <p>{t('about.feedbackBody')}</p>
            </div>
            <a
              className="about-feedback-link"
              href={FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t('about.feedbackLink')}
              <ExternalLink aria-hidden="true" size={16} strokeWidth={1.7} />
            </a>
          </div>
        </section>
      </div>

      <footer className="about-footer">
        <a className="about-footer-brand" href="#/">
          {t('common.brand')}
        </a>
        <div className="about-footer-meta">
          <span>© yuzhou</span>
          <span aria-hidden="true">·</span>
          <a href="#/privacy">{t('common.privacy')}</a>
        </div>
        <LanguageSwitcher compact />
      </footer>
    </main>
  )
}
