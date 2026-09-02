import ePub from 'epubjs'
import {
  saveImportedBooks,
  type ImportedBookEntry,
} from '../data/indexed-db/book-repository'
import { createBookFingerprint } from './book-fingerprint'
import type { BookRecord } from '../types/book'

const EPUB_FILE_PATTERN = /\.epub$/i

function stripExtension(fileName: string): string {
  return fileName.replace(EPUB_FILE_PATTERN, '')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function extractCoverDataUrl(
  coverUrl: string | null,
): Promise<string | undefined> {
  if (!coverUrl) return undefined

  try {
    const response = await fetch(coverUrl, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return undefined
    return await blobToDataUrl(await response.blob())
  } catch {
    return undefined
  }
}

export interface EpubImportFailure {
  fileName: string
  message: string
}

export interface EpubImportDuplicate {
  fileName: string
  existingTitle: string
}

export interface EpubImportResult {
  imported: BookRecord[]
  duplicates: EpubImportDuplicate[]
  failures: EpubImportFailure[]
}

async function prepareEpub(
  file: File,
  addedAt: number,
): Promise<ImportedBookEntry> {
  if (!EPUB_FILE_PATTERN.test(file.name)) {
    throw new Error('不是 EPUB 文件。')
  }

  const data = await file.arrayBuffer()
  const epubBook = ePub(data.slice(0))

  try {
    const [, metadata, coverDataUrl, fingerprint] = await Promise.all([
      epubBook.ready,
      epubBook.loaded.metadata,
      epubBook.coverUrl().then(extractCoverDataUrl),
      createBookFingerprint(data),
    ])
    const title = metadata.title?.trim() || stripExtension(file.name)
    const author = metadata.creator?.trim() || '未知作者'
    const book: BookRecord & { fingerprint: string } = {
      id: crypto.randomUUID(),
      title,
      author,
      coverDataUrl,
      fileName: file.name,
      fileSize: data.byteLength,
      fingerprint,
      addedAt,
      progress: 0,
      readingStatus: 'unread',
      isFavorite: false,
      tags: [],
    }

    return { book, data }
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `无法读取这本 EPUB：${error.message}`
        : '无法读取这本 EPUB。',
    )
  } finally {
    epubBook.destroy()
  }
}

export async function importEpubFiles(
  files: File[],
): Promise<EpubImportResult> {
  const importedAt = Date.now()
  const preparedResults = await Promise.all(
    files.map(async (file, index) => {
      try {
        return {
          entry: await prepareEpub(file, importedAt - index),
          failure: undefined,
        }
      } catch (error) {
        return {
          entry: undefined,
          failure: {
            fileName: file.name,
            message:
              error instanceof Error ? error.message : '无法读取这本 EPUB。',
          },
        }
      }
    }),
  )
  const entries = preparedResults.flatMap(({ entry }) =>
    entry ? [entry] : [],
  )
  const failures = preparedResults.flatMap(({ failure }) =>
    failure ? [failure] : [],
  )
  const saved = await saveImportedBooks(entries)

  return {
    imported: saved.imported,
    duplicates: saved.duplicates.map(({ book, existingBook }) => ({
      fileName: book.fileName,
      existingTitle: existingBook.title,
    })),
    failures,
  }
}
