import type { BookRecord, ReadingAsset } from '../types/book'

export type ReadingAssetExportFormat = 'markdown' | 'text'

export function createReadingAssetExportContent(
  book: BookRecord,
  assets: ReadingAsset[],
  format: ReadingAssetExportFormat,
): string {
  return format === 'markdown'
    ? createMarkdown(book, assets)
    : createPlainText(book, assets)
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}

function getAssetLocation(asset: ReadingAsset): string {
  return asset.chapterLabel?.trim() || '未标注章节'
}

function createMarkdown(book: BookRecord, assets: ReadingAsset[]): string {
  const bookmarks = assets.filter((asset) => asset.kind === 'bookmark')
  const highlights = assets.filter((asset) => asset.kind === 'highlight')
  const lines = [
    `# 《${book.title}》阅读记录`,
    '',
    `作者：${book.author || '未知作者'}`,
    `导出时间：${formatDate(Date.now())}`,
  ]

  if (bookmarks.length > 0) {
    lines.push('', '## 书签', '')
    bookmarks.forEach((bookmark) => {
      lines.push(
        `- ${getAssetLocation(bookmark)} · ${formatDate(bookmark.createdAt)}`,
      )
    })
  }

  if (highlights.length > 0) {
    lines.push('', '## 划线与笔记')
    highlights.forEach((highlight) => {
      lines.push(
        '',
        `### ${getAssetLocation(highlight)}`,
        '',
        ...highlight.text.split('\n').map((line) => `> ${line}`),
      )
      if (highlight.note) lines.push('', `批注：${highlight.note}`)
      lines.push('', `记录于 ${formatDate(highlight.createdAt)}`)
    })
  }

  if (assets.length === 0) lines.push('', '暂无书签、划线或笔记。')
  return `${lines.join('\n').trim()}\n`
}

function createPlainText(book: BookRecord, assets: ReadingAsset[]): string {
  const bookmarks = assets.filter((asset) => asset.kind === 'bookmark')
  const highlights = assets.filter((asset) => asset.kind === 'highlight')
  const lines = [
    `《${book.title}》阅读记录`,
    `作者：${book.author || '未知作者'}`,
    `导出时间：${formatDate(Date.now())}`,
  ]

  if (bookmarks.length > 0) {
    lines.push('', '书签')
    bookmarks.forEach((bookmark) => {
      lines.push(
        `- ${getAssetLocation(bookmark)} · ${formatDate(bookmark.createdAt)}`,
      )
    })
  }

  if (highlights.length > 0) {
    lines.push('', '划线与笔记')
    highlights.forEach((highlight) => {
      lines.push('', `[${getAssetLocation(highlight)}]`, highlight.text)
      if (highlight.note) lines.push(`批注：${highlight.note}`)
      lines.push(`记录于 ${formatDate(highlight.createdAt)}`)
    })
  }

  if (assets.length === 0) lines.push('', '暂无书签、划线或笔记。')
  return `${lines.join('\n').trim()}\n`
}

function createSafeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
  return normalized || '阅读记录'
}

export function downloadReadingAssets(
  book: BookRecord,
  assets: ReadingAsset[],
  format: ReadingAssetExportFormat,
): void {
  const content = createReadingAssetExportContent(book, assets, format)
  const extension = format === 'markdown' ? 'md' : 'txt'
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${createSafeFileName(book.title)}-阅读记录.${extension}`
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
