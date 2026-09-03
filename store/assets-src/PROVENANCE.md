# Chrome Web Store 素材来源

更新时间：2026-09-03

| 输出文件 | 来源 | 生成方式 |
| --- | --- | --- |
| `assets/icon-128.png` | `icon-128.svg` | 使用 `rsvg-convert` 按 128×128 导出，保留 16 px 商店安全边距 |
| `assets/promo-small-440x280.png` | `promo-small-440x280.svg` | 使用项目品牌色、图标和固定文案确定性导出 |
| `assets/screenshot-library-1280x800.png` | Web 生产构建 | 在 1280×800 视口截取真实书库界面，书籍来自 `create-demo-epubs.mjs` |
| `assets/screenshot-reader-1280x800.png` | Web 生产构建 | 在 1280×800 视口截取真实 EPUB 阅读界面，未叠加模拟 UI |

宣传图固定文案为“卷舍 · Lento”和“把时间留给书。”。截图中的书名、作者、封面和正文均由仓库内的演示 EPUB 生成器提供，不包含个人书库内容。
