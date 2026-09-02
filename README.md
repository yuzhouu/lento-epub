# 卷舍 · Lento

> 把时间留给书。
> Read without hurry.

一个简洁的 EPUB 阅读器，同时提供独立网站与 Chrome MV3 扩展。书本与阅读进度仅保存在当前浏览器的 IndexedDB 中，不会上传到远程服务。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

这会分别生成：

- `dist/web`：可部署到任意静态托管服务的网站与 PWA
- `dist/extension`：可加载到 Chrome 的 MV3 扩展

也可以单独构建：

```bash
npm run build:web
npm run build:extension
```

### 部署独立网站

托管平台的构建命令使用 `npm run build:web`，发布目录设置为 `dist/web`。网站使用 Hash 路由，不需要额外配置 SPA 回退。

若网站部署在域名子目录下，通过 `LENTO_BASE_PATH` 指定公开路径：

```bash
LENTO_BASE_PATH=/lento/ npm run build:web
```

网站构建包含 Web App Manifest 和按实际构建产物生成的 Service Worker。首次在线打开后，应用外壳与阅读器资源可以离线使用；支持的浏览器还会显示“安装应用”入口。

### 加载 Chrome 扩展

在 `chrome://extensions` 开启“开发者模式”，选择“加载已解压的扩展程序”，加载项目中的 `dist/extension` 目录。点击工具栏中的卷舍图标即可打开阅读器。

## 当前能力

- 批量选择或拖放导入本地 `.epub` 文件，并检测内容重复的书籍
- 从 EPUB 元数据读取书名、作者与封面
- 本地保存书本、阅读位置与进度
- 按书名或作者搜索，并按最近阅读、添加时间或阅读进度排序
- 管理未读、在读、读完状态，以及收藏和自定义标签；这些信息会随书库备份迁移
- 删除书籍及其本地 EPUB 文件，支持删除确认与 8 秒撤销
- 导出与恢复包含 EPUB、书籍信息和阅读进度的 `.lento` 书库备份，恢复前可预览冲突并逐本选择覆盖、保留两本或跳过
- 目录跳转、翻页、字号与纸张主题
- 桌面与移动宽度适配
- 独立网站安装与离线应用外壳

网站、扩展以及不同域名各自拥有独立的浏览器存储。需要迁移时，先在原环境导出书库备份，再在新环境恢复；恢复操作会先预览冲突，再按你的选择合并书架，不会删除其他书籍。
