import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../LanguageSwitcher'

const PRIVACY_FEEDBACK_URL =
  'https://github.com/yuzhouu/lento-epub/issues/new?title=%5B%E9%9A%90%E7%A7%81%5D%20'

export function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <main className="about-page privacy-page">
      <header className="about-header">
        <a className="about-back-link" href="#/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.7} />
          {t('common.backToLibrary')}
        </a>
        <a className="about-brand" href="#/" aria-label={t('about.homeLabel')}>
          {t('common.brand')}
        </a>
      </header>

      <div className="about-content privacy-content">
        <section
          className="about-hero privacy-hero"
          aria-labelledby="privacy-page-title"
        >
          <p className="about-eyebrow">{t('privacy.eyebrow')}</p>
          <h1 id="privacy-page-title">{t('privacy.title')}</h1>
          <p className="about-intro">{t('privacy.intro')}</p>
          <p className="privacy-effective-date">{t('privacy.effectiveDate')}</p>
        </section>

        <article className="privacy-document">
          <section>
            <span>01</span>
            <div>
              <h2>{t('privacy.scopeTitle')}</h2>
              <p>{t('privacy.scopeBody')}</p>
            </div>
          </section>

          <section>
            <span>02</span>
            <div>
              <h2>{t('privacy.localDataTitle')}</h2>
              <ul>
                <li>{t('privacy.localData1')}</li>
                <li>{t('privacy.localData2')}</li>
                <li>{t('privacy.localData3')}</li>
              </ul>
              <p>{t('privacy.localDataPurpose')}</p>
            </div>
          </section>

          <section>
            <span>03</span>
            <div>
              <h2>{t('privacy.storageTitle')}</h2>
              <p>{t('privacy.storageBody1')}</p>
              <p>{t('privacy.storageBody2')}</p>
            </div>
          </section>

          <section>
            <span>04</span>
            <div>
              <h2>{t('privacy.chromeTitle')}</h2>
              <p>
                {t('privacy.chromeBefore')} <code>fontSettings</code>{' '}
                {t('privacy.chromeAfter')}
              </p>
            </div>
          </section>

          <section>
            <span>05</span>
            <div>
              <h2>{t('privacy.retentionTitle')}</h2>
              <p>{t('privacy.retentionBody')}</p>
            </div>
          </section>

          <section>
            <span>06</span>
            <div>
              <h2>{t('privacy.limitedUseTitle')}</h2>
              <p>{t('privacy.limitedUseBody')}</p>
            </div>
          </section>

          <section>
            <span>07</span>
            <div>
              <h2>{t('privacy.updatesTitle')}</h2>
              <p>{t('privacy.updatesBody')}</p>
              <a
                className="privacy-contact-link"
                href={PRIVACY_FEEDBACK_URL}
                target="_blank"
                rel="noreferrer"
              >
                {t('privacy.contact')}
              </a>
            </div>
          </section>
        </article>

        <aside className="privacy-summary" aria-label={t('privacy.summaryLabel')}>
          <ShieldCheck aria-hidden="true" size={24} strokeWidth={1.45} />
          <p>{t('privacy.summary')}</p>
        </aside>
      </div>

      <footer className="about-footer">
        <a className="about-footer-brand" href="#/">
          {t('common.brand')}
        </a>
        <div className="about-footer-meta">
          <span>© yuzhou</span>
          <span aria-hidden="true">·</span>
          <a href="#/about">{t('common.about')}</a>
        </div>
        <LanguageSwitcher compact />
      </footer>
    </main>
  )
}
