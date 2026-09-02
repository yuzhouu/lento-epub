export type BookReadingStatus = 'unread' | 'reading' | 'finished'

export type ReadingHighlightColor =
  | 'yellow'
  | 'orange'
  | 'lime'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'rose'
  | 'violet'

export type ReadingHighlightStyle = 'wave' | 'single' | 'double'

interface ReadingAssetBase {
  id: string
  bookId: string
  cfi: string
  href?: string
  chapterLabel?: string
  createdAt: number
  updatedAt: number
}

export interface ReadingBookmark extends ReadingAssetBase {
  kind: 'bookmark'
}

export interface ReadingHighlight extends ReadingAssetBase {
  kind: 'highlight'
  text: string
  color: ReadingHighlightColor
  lineStyle?: ReadingHighlightStyle
  note?: string
}

export type ReadingAsset = ReadingBookmark | ReadingHighlight

export interface BookRecord {
  id: string
  title: string
  author: string
  coverDataUrl?: string
  fileName: string
  fileSize: number
  fingerprint?: string
  addedAt: number
  lastOpenedAt?: number
  progress: number
  location?: string
  chapterLabel?: string
  readingStatus?: BookReadingStatus
  isFavorite?: boolean
  tags?: string[]
}

export interface BookFileRecord {
  id: string
  data: ArrayBuffer
}

export interface LibraryBackupEntry {
  book: BookRecord
  data: ArrayBuffer
}

export interface DeletedBookEntry {
  book: BookRecord
  data?: ArrayBuffer
  readingAssets?: ReadingAsset[]
}

export interface TocItem {
  id: string
  href: string
  label: string
  subitems?: TocItem[]
}

export interface ReaderLocation {
  start: {
    cfi: string
    href: string
    percentage?: number
    displayed?: {
      page: number
      total: number
    }
  }
}
