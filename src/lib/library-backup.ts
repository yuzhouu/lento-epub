import JSZip from 'jszip'
import {
  getLibraryBackupEntries,
  restoreLibraryBackupEntries,
} from './book-storage'
import type { BookRecord, LibraryBackupEntry } from '../types/book'

const BACKUP_FORMAT = 'lento-library-backup'
const BACKUP_VERSION = 1
const MANIFEST_FILE_NAME = 'library.json'
const MAX_BACKUP_BOOKS = 1000

interface BackupBookEntry {
  record: BookRecord
  file: string
}

interface BackupManifest {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  books: BackupBookEntry[]
}

export interface LibraryBackupResult {
  bookCount: number
  books?: BookRecord[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key]
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error('备份中的书籍信息不完整。')
  }
  return field
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key]
  if (field === undefined) return undefined
  if (typeof field !== 'string') {
    throw new Error('备份中的书籍信息不完整。')
  }
  return field
}

function readRequiredNumber(
  value: Record<string, unknown>,
  key: string,
): number {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error('备份中的书籍信息不完整。')
  }
  return field
}

function readOptionalNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const field = value[key]
  if (field === undefined) return undefined
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error('备份中的书籍信息不完整。')
  }
  return field
}

function parseBookRecord(value: unknown): BookRecord {
  if (!isObject(value)) throw new Error('备份中的书籍信息不完整。')

  const progress = readRequiredNumber(value, 'progress')
  if (progress < 0 || progress > 1) {
    throw new Error('备份中的阅读进度无效。')
  }

  return {
    id: readRequiredString(value, 'id'),
    title: readRequiredString(value, 'title'),
    author: readRequiredString(value, 'author'),
    fileName: readRequiredString(value, 'fileName'),
    fileSize: readOptionalNumber(value, 'fileSize') ?? 0,
    fingerprint: readOptionalString(value, 'fingerprint'),
    addedAt: readRequiredNumber(value, 'addedAt'),
    lastOpenedAt: readOptionalNumber(value, 'lastOpenedAt'),
    progress,
    location: readOptionalString(value, 'location'),
    chapterLabel: readOptionalString(value, 'chapterLabel'),
    coverDataUrl: readOptionalString(value, 'coverDataUrl'),
  }
}

function parseManifest(value: unknown): BackupManifest {
  if (!isObject(value) || value.format !== BACKUP_FORMAT) {
    throw new Error('这不是卷舍书库备份。')
  }
  if (value.version !== BACKUP_VERSION) {
    throw new Error('这个备份版本暂不受支持。')
  }
  if (!Array.isArray(value.books) || value.books.length === 0) {
    throw new Error('备份中没有可以恢复的书籍。')
  }
  if (value.books.length > MAX_BACKUP_BOOKS) {
    throw new Error('备份中的书籍数量过多。')
  }

  const seenIds = new Set<string>()
  const books = value.books.map((entry) => {
    if (!isObject(entry)) throw new Error('备份中的书籍信息不完整。')
    const record = parseBookRecord(entry.record)
    const file = readRequiredString(entry, 'file')
    if (!/^books\/[a-z0-9-]+\.epub$/i.test(file)) {
      throw new Error('备份中的书籍文件路径无效。')
    }
    if (seenIds.has(record.id)) {
      throw new Error('备份中包含重复的书籍。')
    }
    seenIds.add(record.id)
    return { record, file }
  })

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt:
      typeof value.exportedAt === 'string' ? value.exportedAt : '',
    books,
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportLibraryBackup(): Promise<LibraryBackupResult> {
  const entries = await getLibraryBackupEntries()
  if (entries.length === 0) throw new Error('书架里还没有可以备份的书。')

  const zip = new JSZip()
  const books: BackupBookEntry[] = entries.map(({ book, data }, index) => {
    const file = `books/${String(index + 1).padStart(4, '0')}.epub`
    zip.file(file, data)
    return { record: book, file }
  })
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    books,
  }
  zip.file(MANIFEST_FILE_NAME, JSON.stringify(manifest, null, 2))

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(blob, `lento-library-${date}.lento`)
  return { bookCount: entries.length }
}

export async function importLibraryBackup(
  file: File,
): Promise<LibraryBackupResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('无法打开这个书库备份。')
  }

  const manifestFile = zip.file(MANIFEST_FILE_NAME)
  if (!manifestFile) throw new Error('备份中缺少书库信息。')

  let manifestValue: unknown
  try {
    manifestValue = JSON.parse(await manifestFile.async('string'))
  } catch {
    throw new Error('备份中的书库信息已经损坏。')
  }
  const manifest = parseManifest(manifestValue)

  const entries = await Promise.all(
    manifest.books.map(async ({ record, file: filePath }) => {
      const bookFile = zip.file(filePath)
      if (!bookFile) throw new Error(`《${record.title}》的书籍文件缺失。`)
      const data = await bookFile.async('arraybuffer')
      if (data.byteLength === 0) {
        throw new Error(`《${record.title}》的书籍文件为空。`)
      }
      return { book: record, data } satisfies LibraryBackupEntry
    }),
  )
  const books = await restoreLibraryBackupEntries(entries)
  return { bookCount: entries.length, books }
}
