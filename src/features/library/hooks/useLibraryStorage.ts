import { useEffect, useState } from 'react'
import {
  getLibraryStorageInfo,
  type LibraryStorageInfo,
} from '../../../data/indexed-db/storage-capacity'
import type { BookRecord } from '../../../types/book'

export function useLibraryStorage(books: BookRecord[]) {
  const [storageInfo, setStorageInfo] = useState<LibraryStorageInfo>()

  useEffect(() => {
    let isCurrent = true
    const bookBytes = books.reduce((total, book) => total + book.fileSize, 0)
    void getLibraryStorageInfo(bookBytes).then((info) => {
      if (isCurrent) setStorageInfo(info)
    })
    return () => {
      isCurrent = false
    }
  }, [books])

  return storageInfo
}
