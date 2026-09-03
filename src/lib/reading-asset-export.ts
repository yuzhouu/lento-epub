import type { BookRecord, ReadingAsset } from '../types/book'
import i18n, { getCurrentLanguage } from '../i18n'

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
  return new Intl.DateTimeFormat(getCurrentLanguage(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}

function getAssetLocation(asset: ReadingAsset): string {
  return asset.chapterLabel?.trim() || i18n.t('exportData.unknownChapter')
}

function createMarkdown(book: BookRecord, assets: ReadingAsset[]): string {
  const bookmarks = assets.filter((asset) => asset.kind === 'bookmark')
  const highlights = assets.filter((asset) => asset.kind === 'highlight')
  const lines = [
    `# ${i18n.t('exportData.title', { title: book.title })}`,
    '',
    i18n.t('exportData.author', { author: book.author || i18n.t('exportData.unknownAuthor') }),
    i18n.t('exportData.exportedAt', { date: formatDate(Date.now()) }),
  ]

  if (bookmarks.length > 0) {
    lines.push('', `## ${i18n.t('exportData.bookmarks')}`, '')
    bookmarks.forEach((bookmark) => {
      lines.push(
        `- ${getAssetLocation(bookmark)} · ${formatDate(bookmark.createdAt)}`,
      )
    })
  }

  if (highlights.length > 0) {
    lines.push('', `## ${i18n.t('exportData.highlights')}`)
    highlights.forEach((highlight) => {
      lines.push(
        '',
        `### ${getAssetLocation(highlight)}`,
        '',
        ...highlight.text.split('\n').map((line) => `> ${line}`),
      )
      if (highlight.note) {
        lines.push('', i18n.t('exportData.note', { note: highlight.note }))
      }
      lines.push('', i18n.t('exportData.recordedAt', { date: formatDate(highlight.createdAt) }))
    })
  }

  if (assets.length === 0) lines.push('', i18n.t('exportData.empty'))
  return `${lines.join('\n').trim()}\n`
}

function createPlainText(book: BookRecord, assets: ReadingAsset[]): string {
  const bookmarks = assets.filter((asset) => asset.kind === 'bookmark')
  const highlights = assets.filter((asset) => asset.kind === 'highlight')
  const lines = [
    i18n.t('exportData.title', { title: book.title }),
    i18n.t('exportData.author', { author: book.author || i18n.t('exportData.unknownAuthor') }),
    i18n.t('exportData.exportedAt', { date: formatDate(Date.now()) }),
  ]

  if (bookmarks.length > 0) {
    lines.push('', i18n.t('exportData.bookmarks'))
    bookmarks.forEach((bookmark) => {
      lines.push(
        `- ${getAssetLocation(bookmark)} · ${formatDate(bookmark.createdAt)}`,
      )
    })
  }

  if (highlights.length > 0) {
    lines.push('', i18n.t('exportData.highlights'))
    highlights.forEach((highlight) => {
      lines.push('', `[${getAssetLocation(highlight)}]`, highlight.text)
      if (highlight.note) {
        lines.push(i18n.t('exportData.note', { note: highlight.note }))
      }
      lines.push(i18n.t('exportData.recordedAt', { date: formatDate(highlight.createdAt) }))
    })
  }

  if (assets.length === 0) lines.push('', i18n.t('exportData.empty'))
  return `${lines.join('\n').trim()}\n`
}

function createSafeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
  return normalized || i18n.t('exportData.defaultName')
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
  link.download = `${createSafeFileName(book.title)}-${i18n.t('exportData.fileSuffix')}.${extension}`
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
