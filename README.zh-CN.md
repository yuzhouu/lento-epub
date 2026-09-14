<p align="center">
  <img src="public/icons/lento-128.png" width="96" height="96" alt="卷舍图标">
</p>

<h1 align="center">卷舍 · Lento</h1>

<p align="center">
  <strong>一个安静、私密的浏览器 EPUB 阅读器。</strong><br>
  把时间留给书。Read without hurry.
</p>

<p align="center">
  <a href="https://yuzhouu.github.io/lento-epub/">在线阅读</a> ·
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="PRIVACY.md">隐私政策</a> ·
  <a href="https://github.com/yuzhouu/lento-epub/issues">反馈</a>
</p>

![卷舍书架](store/assets/screenshot-library-1280x800.png)

卷舍把 EPUB 书架与阅读空间收在一个安静、简洁的地方。导入自己的书，按习惯整理，并从上次停下的位置继续阅读——不需要注册账户，也不会把你的阅读生活发送到服务器。

## 好好整理自己的书

- 选择或拖放多个 EPUB，一次加入书架
- 直接读取书中的标题、作者与封面
- 按书名或作者搜索，并按最近阅读、添加时间或阅读进度排序
- 用未读、在读、读完状态，以及收藏和自定义标签整理书架
- 根据内容识别重复书籍，避免书架越用越乱

## 阅读空间，顺着你的习惯

![卷舍阅读器](store/assets/screenshot-reader-1280x800.png)

在章节滚动、连续滚动与传统分页之间自由切换。细调字体、字号、行距、版心宽度、段落样式和纸张主题，让页面读起来刚刚好。目录、全文搜索与阅读进度随手可用，却不会挤占正文。

界面适配桌面与移动宽度，并提供简体中文、英文、日文、俄文、法文和西班牙文。

## 留下真正重要的内容

为当前页添加书签，或选中文字保存彩色划线与批注。所有阅读记录都能按书集中查看，也可以随时导出为 Markdown 或纯文本，带到其他地方继续使用。

## 本地优先，是基本设计

EPUB 文件、阅读位置、进度、书签、划线、批注与偏好都留在当前浏览器。卷舍没有账户、广告或行为分析，也不会上传你的书籍和阅读记录。

更换浏览器或设备时，可以导出包含书籍与阅读数据的 `.lento` 备份。在新书架恢复前，卷舍会展示冲突，让你逐本选择覆盖、保留两本或跳过。

## 用适合自己的方式打开

卷舍提供独立网站、可安装且支持离线应用外壳的 PWA，以及 Chrome 扩展。每个安装环境都有彼此独立的本地书架，只有在你主动导出并恢复备份时，数据才会移动。

## 网站构建与收录

`npm run build:web` 会在 `dist/web` 生成首页、`about/` 和 `privacy/` 的完整 HTML，以及网站地图、抓取配置和离线缓存。阅读器仍使用本地书库和书籍地址；书籍、阅读记录不会进入网站地图。

GitHub Pages 工作流自动传入 `LENTO_BASE_PATH` 和 `LENTO_SITE_URL`。部署到其他域名时，将 `LENTO_SITE_URL` 设为网站完整 HTTPS 地址（包含部署子路径），并设置对应的 `LENTO_BASE_PATH`。构建会校验正文、规范网址、静态资源和网站地图，阻止本机地址或错误链接进入产物。

当前网站地图地址为 `https://yuzhouu.github.io/lento-epub/sitemap.xml`。子目录内的 `robots.txt` 不控制整个域名；域名根站的 `robots.txt` 需要列出这份网站地图。发布后，在 Google Search Console、Bing Webmaster Tools 等站长平台验证网站所有权，提交网站地图，并通过 URL 检查确认实际收录状态。
