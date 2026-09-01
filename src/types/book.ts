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
