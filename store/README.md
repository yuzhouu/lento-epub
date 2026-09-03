# Chrome Web Store 发布资料

这里保存可直接粘贴到 Chrome Web Store Developer Dashboard 的文案、隐私披露和上架素材。应用版本以 `extension/manifest.json` 为准。

## Store listing

- 名称：`卷舍 Lento｜EPUB 阅读器`
- 简短说明：`一个安静、简洁的 EPUB 阅读器。把时间留给书。`
- 主要语言：`中文（简体）`
- 类别：`生产力工具`
- 支持网址：`https://github.com/yuzhouu/lento-epub/issues`
- 主页：`https://yuzhouu.github.io/lento-epub/`
- 隐私政策：`https://yuzhouu.github.io/lento-epub/#/privacy`

### 详细说明

卷舍 · Lento 是一个安静、简洁、本地优先的 EPUB 阅读器。把自己的 EPUB 放进书架，在 Chrome 中直接整理与阅读；书籍和阅读记录只保存在当前浏览器，不会上传到远程服务。

主要功能：

- 批量选择或拖放导入本地 EPUB，并识别内容重复的书籍
- 读取书名、作者与封面，按关键词、阅读状态、收藏和标签整理书架
- 在章节滚动、连续滚动和分页阅读之间切换
- 调整字体、字号、行距、版心宽度、段落样式与纸张主题
- 保存阅读位置、进度、书签、彩色划线和批注
- 导出阅读记录为 Markdown 或纯文本
- 导出和恢复包含 EPUB 与阅读记录的完整书库备份

隐私说明：卷舍没有账户、广告或分析服务。扩展只申请 `fontSettings` 权限，并且只在你主动使用“发现系统字体”时读取可用字体名称。扩展不访问网页内容、浏览历史或远程主机。

## Privacy practices

### Single purpose

让用户在 Chrome 中导入、整理和阅读自己持有的 EPUB，并在本地保存阅读进度、书签、划线与批注。

### Permission justification

`fontSettings`：仅在用户主动点击“发现系统字体”时读取系统可用字体名称，并在阅读设置中显示字体样张和允许用户选择。完整字体列表不会上传，也不会跨运行持久化；只会在本地保存用户选中的字体名称。

### Remote code

选择 `No, I am not using remote code`。扩展的 JavaScript、CSS 和其他可执行资源全部包含在上传的 ZIP 中；运行时不会下载或执行远程代码。

### Data usage

- 披露 `User activity`：阅读位置、进度、阅读状态、收藏、标签、书签、划线、批注、书内搜索记录与阅读偏好只存储在本地，用来提供用户可见的阅读功能。
- `Website content` 选择否：扩展没有 content script 或 host permissions，不读取用户访问的网页。用户主动选择的本地 EPUB 会在设备上处理，并已在隐私政策中单独说明。
- 其他数据类型选择否：不收集身份、健康、财务、认证、个人通信、位置或浏览历史数据。
- 勾选全部 Limited Use 认证：数据不出售、不用于与单一用途无关的目的、不用于信用判断或借贷，也不会传输给第三方。

如果 Developer Dashboard 的字段名称或定义与上述不同，以字段内当前说明为准，并保持后台披露、应用实际行为和隐私政策三者一致。

## Distribution

- Visibility：`Public`
- Regions：按目标市场选择；首发可选择全部可用地区
- Pricing：免费，无应用内购买
- Trusted testers：首次公开发布前如需灰度验证，可先切为私有并填写测试账号

## Test instructions

应用不需要登录、付费账号或外部服务，测试说明不是必填。需要填写时可使用：

> 安装后点击工具栏中的卷舍图标打开书架。选择任意不含 DRM 的 `.epub` 文件导入，点击书籍开始阅读。阅读设置中的“发现系统字体”会使用 `fontSettings` 权限列出本机字体；书籍、进度、书签、划线与批注只保存在当前 Chrome 配置文件中。

## 素材

- `assets/icon-128.png`：128×128 商店图标，主体四周保留 16 px 透明边距
- `assets/screenshot-library-1280x800.png`：书架实际界面
- `assets/screenshot-reader-1280x800.png`：阅读实际界面
- `assets/promo-small-440x280.png`：必需的小型宣传图
- `assets-src/`：可编辑的 SVG 源文件

Chrome Web Store 最少需要 1 张 1280×800 或 640×400 截图，最多 5 张；小型宣传图为 440×280。1400×560 marquee 图和 YouTube 视频可选。

## 发布顺序

1. 在 GitHub 仓库 Settings → Pages 中选择 GitHub Actions；推送 `main` 后确认主页和隐私政策 URL 可公开访问。
2. Google 账号开启两步验证，注册 Chrome Web Store 开发者并完成一次性费用与邮箱验证。
3. 执行 `npm run release:extension`，上传 `release/chrome-web-store/lento-epub-reader-<version>.zip`。
4. 填写 Store listing、Privacy practices 和 Distribution；上传本目录中的图像素材。
5. 先以开发者模式加载 `dist/extension`，验证工具栏入口、EPUB 导入、阅读、字体发现和重启后的本地数据。
6. 提交审核。后续每次上传前必须提高 `extension/manifest.json` 的版本号，并同步 `package.json`。
