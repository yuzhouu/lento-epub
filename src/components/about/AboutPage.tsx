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

const FEEDBACK_URL =
  'https://github.com/yuzhouu/lento-epub/issues/new?title=%5B%E5%8F%8D%E9%A6%88%5D%20'

const FEATURES = [
  {
    icon: Library,
    title: '收好每一本书',
    description:
      '批量导入本地 EPUB，按书名或作者搜索，并用阅读状态、收藏和标签整理书架。',
  },
  {
    icon: BookOpenText,
    title: '按自己的节奏阅读',
    description:
      '在章节滚动、连续滚动和分页间切换，调整字号、字体与纸张主题，目录和进度随时可用。',
  },
  {
    icon: BookMarked,
    title: '留下真正有用的痕迹',
    description:
      '保存阅读位置、书签、彩色划线与批注，并把阅读记录导出为 Markdown 或纯文本。',
  },
  {
    icon: HardDriveDownload,
    title: '带走完整书库',
    description:
      '将 EPUB、书籍信息和阅读进度一起备份，需要换浏览器或设备时再完整恢复。',
  },
] as const

export function AboutPage() {
  return (
    <main className="about-page">
      <header className="about-header">
        <a className="about-back-link" href="#/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.7} />
          回到书架
        </a>
        <a className="about-brand" href="#/" aria-label="卷舍 Lento 首页">
          卷舍 · Lento
        </a>
      </header>

      <div className="about-content">
        <section className="about-hero" aria-labelledby="about-title">
          <p className="about-eyebrow">ABOUT LENTO</p>
          <h1 id="about-title">把时间留给书。</h1>
          <p className="about-intro">
            卷舍是一间安静、简洁的本地 EPUB 书房。从整理书架到专注阅读，
            它把需要的工具放在手边，也把不必要的打扰留在门外。
          </p>
          <p className="about-slogan">Read without hurry.</p>
        </section>

        <section className="about-feature-section" aria-labelledby="features-title">
          <div className="about-section-heading">
            <span>01</span>
            <h2 id="features-title">为完整阅读过程而做</h2>
          </div>
          <div className="about-feature-list">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <article className="about-feature" key={feature.title}>
                  <Icon aria-hidden="true" size={21} strokeWidth={1.45} />
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="about-privacy" aria-labelledby="privacy-title">
          <ShieldCheck aria-hidden="true" size={25} strokeWidth={1.4} />
          <div>
            <p className="about-section-kicker">LOCAL FIRST</p>
            <h2 id="privacy-title">书和阅读记录，只属于你</h2>
            <p>
              导入的书籍、阅读进度、书签和批注只保存在当前浏览器，不会上传到远程服务。
              网站、Chrome 扩展和不同域名的书库彼此独立，需要迁移时可使用书库备份。
            </p>
            <a className="about-privacy-link" href="#/privacy">
              查看完整隐私政策
            </a>
          </div>
        </section>

        <section className="about-feedback" aria-labelledby="feedback-title">
          <div className="about-section-heading">
            <span>02</span>
            <h2 id="feedback-title">一起把阅读体验做得更好</h2>
          </div>
          <div className="about-feedback-body">
            <div>
              <MessageCircleMore
                aria-hidden="true"
                size={25}
                strokeWidth={1.45}
              />
              <p>
                遇到问题，或有想要的功能，都可以在 GitHub 提交反馈。
                如果是故障，请附上使用环境、复现步骤和截图，方便更快定位。
              </p>
            </div>
            <a
              className="about-feedback-link"
              href={FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
            >
              提交反馈
              <ExternalLink aria-hidden="true" size={16} strokeWidth={1.7} />
            </a>
          </div>
        </section>
      </div>

      <footer className="about-footer">
        <a className="about-footer-brand" href="#/">
          卷舍 · Lento
        </a>
        <div className="about-footer-meta">
          <span>© yuzhou</span>
          <span aria-hidden="true">·</span>
          <a href="#/privacy">隐私政策</a>
        </div>
      </footer>
    </main>
  )
}
