import { ArrowLeft, ShieldCheck } from 'lucide-react'

const PRIVACY_FEEDBACK_URL =
  'https://github.com/yuzhouu/lento-epub/issues/new?title=%5B%E9%9A%90%E7%A7%81%5D%20'

export function PrivacyPage() {
  return (
    <main className="about-page privacy-page">
      <header className="about-header">
        <a className="about-back-link" href="#/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.7} />
          回到书架
        </a>
        <a className="about-brand" href="#/" aria-label="卷舍 Lento 首页">
          卷舍 · Lento
        </a>
      </header>

      <div className="about-content privacy-content">
        <section
          className="about-hero privacy-hero"
          aria-labelledby="privacy-page-title"
        >
          <p className="about-eyebrow">PRIVACY POLICY</p>
          <h1 id="privacy-page-title">隐私政策</h1>
          <p className="about-intro">
            卷舍在你的浏览器里完成 EPUB 导入、整理与阅读。
            我们不运营用于接收书籍或阅读记录的服务器，也不加入广告或行为分析。
          </p>
          <p className="privacy-effective-date">生效日期：2026 年 9 月 3 日</p>
        </section>

        <article className="privacy-document">
          <section>
            <span>01</span>
            <div>
              <h2>适用范围</h2>
              <p>
                本政策适用于卷舍 · Lento 的 Chrome 扩展，
                以及由同一代码构建的独立网站和 PWA。
                不同安装环境拥有彼此独立的浏览器存储。
              </p>
            </div>
          </section>

          <section>
            <span>02</span>
            <div>
              <h2>在本地处理的数据</h2>
              <ul>
                <li>
                  你主动选择的 EPUB 文件及其中的书名、作者、封面、
                  正文和用于识别重复书籍的内容指纹。
                </li>
                <li>
                  阅读位置、进度、阅读状态、收藏、标签、书签、划线、
                  批注、书内搜索记录和阅读显示偏好。
                </li>
                <li>
                  仅当你主动使用“发现系统字体”时，读取可用字体名称供你选择；
                  完整字体列表只保留在当前运行期间，
                  你选中的字体名称会作为阅读偏好保存在浏览器中。
                </li>
              </ul>
              <p>
                这些数据仅用于提供书架、阅读、检索、标注、备份恢复与字体选择功能。
              </p>
            </div>
          </section>

          <section>
            <span>03</span>
            <div>
              <h2>存储、传输与共享</h2>
              <p>
                EPUB、书籍信息和阅读记录保存在当前浏览器的 IndexedDB 或 localStorage 中。
                卷舍不会把这些数据上传到开发者或第三方服务器，不出售或共享这些数据，
                也不会将其用于广告、画像或信用判断。
              </p>
              <p>
                导出书库备份、Markdown 或纯文本时，文件由浏览器直接生成并交给你保存。
                点击“提交反馈”会打开 GitHub，但卷舍不会自动附带书籍、阅读记录或其他本地数据；
                你在 GitHub 主动提交的内容受 GitHub 自身政策约束。
              </p>
            </div>
          </section>

          <section>
            <span>04</span>
            <div>
              <h2>Chrome 权限</h2>
              <p>
                Chrome 扩展仅申请 <code>fontSettings</code>{' '}
                权限，用于在你主动发现系统字体时列出可用字体。
                扩展不申请网页访问、浏览历史、标签页内容或远程主机权限。
              </p>
            </div>
          </section>

          <section>
            <span>05</span>
            <div>
              <h2>保留与删除</h2>
              <p>
                本地数据会一直保留，直到你在卷舍中删除对应书籍或阅读记录，
                或通过 Chrome 清除该扩展/网站的数据、卸载扩展。
                阅读偏好和仍未手动清除的书内搜索记录可能在删除单本书后继续保留，
                可通过对应界面或清除浏览器数据移除。
              </p>
            </div>
          </section>

          <section>
            <span>06</span>
            <div>
              <h2>Limited Use 承诺</h2>
              <p>
                卷舍对 Chrome API 与用户数据的使用遵守 Chrome Web Store User Data Policy，
                包括 Limited Use 要求；数据只用于提供或改进用户可见的 EPUB 阅读功能。
              </p>
            </div>
          </section>

          <section>
            <span>07</span>
            <div>
              <h2>政策更新与联系</h2>
              <p>
                功能或数据处理方式发生实质变化时，本页面会同步更新生效日期。
                对本政策有疑问，可在 GitHub 创建隐私问题。
              </p>
              <a
                className="privacy-contact-link"
                href={PRIVACY_FEEDBACK_URL}
                target="_blank"
                rel="noreferrer"
              >
                联系开发者
              </a>
            </div>
          </section>
        </article>

        <aside className="privacy-summary" aria-label="隐私摘要">
          <ShieldCheck aria-hidden="true" size={24} strokeWidth={1.45} />
          <p>无账户 · 无广告 · 无分析 · 不上传书籍与阅读记录</p>
        </aside>
      </div>

      <footer className="about-footer">
        <a className="about-footer-brand" href="#/">
          卷舍 · Lento
        </a>
        <div className="about-footer-meta">
          <span>© yuzhou</span>
          <span aria-hidden="true">·</span>
          <a href="#/about">关于</a>
        </div>
      </footer>
    </main>
  )
}
