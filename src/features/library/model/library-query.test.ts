import { describe, expect, it } from 'vitest'
import type { BookRecord } from '../../../types/book'
import { getLibraryTags, queryLibraryBooks } from './library-query'

function book(
  id: string,
  patch: Partial<BookRecord> = {},
): BookRecord {
  return {
    id,
    title: id,
    author: '作者',
    fileName: `${id}.epub`,
    fileSize: 100,
    addedAt: 1,
    progress: 0,
    ...patch,
  }
}

const books = [
  book('slow-reading', {
    title: '缓慢阅读',
    author: '李明',
    addedAt: 20,
    lastOpenedAt: 80,
    progress: 0.4,
    isFavorite: true,
    tags: ['文学', '随笔'],
  }),
  book('epub-notes', {
    title: 'EPUB 笔记',
    author: '王青',
    addedAt: 30,
    lastOpenedAt: 70,
    progress: 1,
    tags: ['技术', '文学'],
  }),
  book('unread', {
    title: '未拆封',
    author: '李明',
    addedAt: 10,
    tags: ['随笔'],
  }),
]

describe('library query', () => {
  it('deduplicates tags case-insensitively while preserving labels', () => {
    expect(
      getLibraryTags([
        book('a', { tags: ['EPUB'] }),
        book('b', { tags: ['epub', '阅读'] }),
      ]),
    ).toEqual(['阅读', 'EPUB'])
  })

  it('combines token search, status, favorite and tag filters', () => {
    const result = queryLibraryBooks(books, {
      searchQuery: '缓慢 李明',
      sortBy: 'recent',
      statusFilter: 'reading',
      favoriteOnly: true,
      activeTag: '文学',
    })

    expect(result.map(({ id }) => id)).toEqual(['slow-reading'])
  })

  it('sorts by progress with added time as a stable tie breaker', () => {
    const result = queryLibraryBooks(
      [...books, book('finished-newer', { progress: 1, addedAt: 40 })],
      {
        searchQuery: '',
        sortBy: 'progress',
        statusFilter: 'all',
        favoriteOnly: false,
      },
    )

    expect(result.slice(0, 2).map(({ id }) => id)).toEqual([
      'finished-newer',
      'epub-notes',
    ])
  })
})
