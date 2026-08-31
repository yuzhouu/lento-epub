import ePub from 'epubjs'
import { saveImportedBook } from './book-storage'
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

export async function importEpub(file: File): Promise<BookRecord> {
  if (!EPUB_FILE_PATTERN.test(file.name)) {
    throw new Error('请选择 .epub 格式的书本。')
  }

  const data = await file.arrayBuffer()
  const epubBook = ePub(data.slice(0))

  try {
    const metadata = await epubBook.loaded.metadata
    const coverDataUrl = await extractCoverDataUrl(await epubBook.coverUrl())
    const title = metadata.title?.trim() || stripExtension(file.name)
    const author = metadata.creator?.trim() || '未知作者'
    const book: BookRecord = {
      id: crypto.randomUUID(),
      title,
      author,
      coverDataUrl,
      fileName: file.name,
      addedAt: Date.now(),
      progress: 0,
    }

    await saveImportedBook(book, data)
    return book
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
