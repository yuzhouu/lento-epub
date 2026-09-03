import i18n from '../../i18n'
import type {
  BookFileRecord,
  BookRecord,
  LibraryBackupEntry,
} from '../../types/book'
import {
  getBookFileEntries,
  getBooks,
  getStoredBooksWithFingerprints,
} from './book-repository'
import {
  BOOK_STORE,
  FILE_STORE,
  openDatabase,
  requestToPromise,
  transactionToPromise,
} from './database'
import { ensureStorageCapacity } from './storage-capacity'

export type LibraryBackupConflictReason = 'id' | 'fingerprint'
export type LibraryBackupConflictResolution =
  | 'overwrite'
  | 'keep-both'
  | 'skip'

export interface LibraryBackupConflict {
  backupBook: BookRecord
  existingBook: BookRecord
  reason: LibraryBackupConflictReason
}

export interface RestoreLibraryBackupResult {
  books: BookRecord[]
  addedCount: number
  overwrittenCount: number
  keptBothCount: number
  skippedCount: number
}

export const getLibraryBackupEntries = getBookFileEntries

async function getAdditionalFileBytes(
  entries: LibraryBackupEntry[],
): Promise<number> {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readonly')
  const fileStore = transaction.objectStore(FILE_STORE)
  const existingFiles = await Promise.all(
    entries.map(({ book }) =>
      requestToPromise(
        fileStore.get(book.id) as IDBRequest<BookFileRecord | undefined>,
      ),
    ),
  )

  return entries.reduce((total, entry, index) => {
    const existingBytes = existingFiles[index]?.data.byteLength ?? 0
    return total + Math.max(0, entry.data.byteLength - existingBytes)
  }, 0)
}

export async function getLibraryBackupConflicts(
  entries: LibraryBackupEntry[],
): Promise<LibraryBackupConflict[]> {
  const existingBooks = await getStoredBooksWithFingerprints()
  const existingById = new Map(existingBooks.map((book) => [book.id, book]))
  const existingByFingerprint = new Map<string, BookRecord[]>()
  const backupFingerprintCounts = new Map<string, number>()
  const idMatchedExistingIds = new Set(
    entries.flatMap(({ book }) => {
      const match = existingById.get(book.id)
      return match ? [match.id] : []
    }),
  )

  for (const book of existingBooks) {
    if (!book.fingerprint) continue
    const matches = existingByFingerprint.get(book.fingerprint) ?? []
    matches.push(book)
    existingByFingerprint.set(book.fingerprint, matches)
  }
  for (const { book } of entries) {
    if (!book.fingerprint) continue
    backupFingerprintCounts.set(
      book.fingerprint,
      (backupFingerprintCounts.get(book.fingerprint) ?? 0) + 1,
    )
  }

  return entries.flatMap<LibraryBackupConflict>(({ book }) => {
    const idMatch = existingById.get(book.id)
    if (idMatch) {
      return [{ backupBook: book, existingBook: idMatch, reason: 'id' }]
    }
    if (
      !book.fingerprint ||
      backupFingerprintCounts.get(book.fingerprint) !== 1
    ) {
      return []
    }
    const fingerprintMatches = existingByFingerprint.get(book.fingerprint)
    if (fingerprintMatches?.length !== 1) return []
    if (idMatchedExistingIds.has(fingerprintMatches[0].id)) return []

    return [
      {
        backupBook: book,
        existingBook: fingerprintMatches[0],
        reason: 'fingerprint',
      },
    ]
  })
}

export async function restoreLibraryBackupEntries(
  entries: LibraryBackupEntry[],
  conflicts: LibraryBackupConflict[],
  resolutions: ReadonlyMap<string, LibraryBackupConflictResolution>,
): Promise<RestoreLibraryBackupResult> {
  const conflictsByBackupId = new Map(
    conflicts.map((conflict) => [conflict.backupBook.id, conflict]),
  )
  const resolvedEntries: LibraryBackupEntry[] = []
  let addedCount = 0
  let overwrittenCount = 0
  let keptBothCount = 0
  let skippedCount = 0

  for (const entry of entries) {
    const conflict = conflictsByBackupId.get(entry.book.id)
    if (!conflict) {
      resolvedEntries.push(entry)
      addedCount += 1
      continue
    }

    const resolution = resolutions.get(entry.book.id)
    if (!resolution) {
      throw new Error(
        i18n.t('dataErrors.resolutionRequired', { title: entry.book.title }),
      )
    }
    if (resolution === 'skip') {
      skippedCount += 1
      continue
    }
    if (resolution === 'overwrite') {
      resolvedEntries.push({
        book: { ...entry.book, id: conflict.existingBook.id },
        data: entry.data,
      })
      overwrittenCount += 1
      continue
    }

    resolvedEntries.push({
      book: {
        ...entry.book,
        id:
          entry.book.id === conflict.existingBook.id
            ? crypto.randomUUID()
            : entry.book.id,
      },
      data: entry.data,
    })
    keptBothCount += 1
  }

  if (resolvedEntries.length === 0) {
    return {
      books: await getBooks(),
      addedCount,
      overwrittenCount,
      keptBothCount,
      skippedCount,
    }
  }

  await ensureStorageCapacity(await getAdditionalFileBytes(resolvedEntries))
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  for (const { book, data } of resolvedEntries) {
    bookStore.put({ ...book, fileSize: data.byteLength } satisfies BookRecord)
    fileStore.put({ id: book.id, data } satisfies BookFileRecord)
  }
  await transactionComplete

  return {
    books: await getBooks(),
    addedCount,
    overwrittenCount,
    keptBothCount,
    skippedCount,
  }
}
