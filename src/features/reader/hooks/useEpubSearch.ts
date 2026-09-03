import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ePub from 'epubjs'
import type { BookSearchResult } from '../../../components/reader/BookSearchPanel'
import type { TocItem } from '../../../types/book'
import { findChapterLabel } from '../epub/epub-navigation'
import { findSectionMatches } from '../epub/epub-search'
import type { EpubBook, EpubSection } from '../epub/epub-types'

interface SearchProgress {
  completed: number
  total: number
}

export function useEpubSearch(bookId: string, toc: TocItem[]) {
  const { t } = useTranslation()
  const sourceRef = useRef<{ bookId: string; data: ArrayBuffer } | undefined>(
    undefined,
  )
  const searchBookRef = useRef<
    { bookId: string; book: EpubBook } | undefined
  >(undefined)

  useEffect(() => {
    return () => {
      if (searchBookRef.current?.bookId === bookId) {
        searchBookRef.current.book.destroy()
        searchBookRef.current = undefined
      }
      if (sourceRef.current?.bookId === bookId) sourceRef.current = undefined
    }
  }, [bookId])

  function setSource(data: ArrayBuffer) {
    sourceRef.current = { bookId, data }
  }

  async function search(
    query: string,
    signal: AbortSignal,
    onProgress: (progress: SearchProgress) => void,
  ): Promise<BookSearchResult[]> {
    const source = sourceRef.current
    if (!source || source.bookId !== bookId) {
      throw new Error(t('errors.readingNotReady'))
    }

    if (searchBookRef.current?.bookId !== bookId) {
      searchBookRef.current?.book.destroy()
      const searchBook = ePub(source.data.slice(0))
      await searchBook.ready
      searchBookRef.current = { bookId, book: searchBook }
    }

    const searchBook = searchBookRef.current.book
    const sections = (
      searchBook.spine as unknown as { spineItems: EpubSection[] }
    ).spineItems
    const results: BookSearchResult[] = []
    onProgress({ completed: 0, total: sections.length })

    for (let index = 0; index < sections.length; index += 1) {
      if (signal.aborted) throw new DOMException('Search aborted', 'AbortError')
      const section = sections[index]
      await section.load(searchBook.load.bind(searchBook))
      try {
        const chapter =
          findChapterLabel(toc, section.href) ??
          t('errors.chapterFallback', { count: index + 1 })
        findSectionMatches(section, query).forEach((match) => {
          results.push({
            cfi: match.cfi,
            chapter,
            excerpt: match.excerpt || query,
            href: section.href,
          })
        })
      } finally {
        section.unload()
      }
      onProgress({ completed: index + 1, total: sections.length })
    }

    return results
  }

  return { setSource, search }
}
