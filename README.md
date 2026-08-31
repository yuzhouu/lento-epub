# 卷舍 · Lento

> 把时间留给书。
> Read without hurry.

一个简洁的 Chrome MV3 EPUB 阅读器。点击扩展图标会打开完整阅读器页面；书本与阅读进度仅保存在当前浏览器的 IndexedDB 中。

## 本地开发

```bash
npm install
npm run dev
```

## 构建与加载扩展

```bash
npm run build
```

在 `chrome://extensions` 开启“开发者模式”，选择“加载已解压的扩展程序”，加载项目中的 `dist` 目录。点击工具栏中的卷舍图标即可打开阅读器。

## 当前能力

- 导入并解析本地 `.epub` 文件
- 从 EPUB 元数据读取书名、作者与封面
- 本地保存书本、阅读位置与进度
- 目录跳转、翻页、字号与纸张主题
- 桌面与移动宽度适配

书本文件不会上传，也不会使用远程服务。
