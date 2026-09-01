import type {
  BookFileRecord,
  BookRecord,
  DeletedBookEntry,
  LibraryBackupEntry,
} from '../types/book'
import { createBookFingerprint } from './book-fingerprint'

const DATABASE_NAME = 'lento-library'
const DATABASE_VERSION = 3
const BOOK_STORE = 'books'
const FILE_STORE = 'files'
const FINGERPRINT_INDEX = 'fingerprint'
const LOW_STORAGE_BYTES = 100 * 1024 * 1024
const LOW_STORAGE_RATIO = 0.05

export interface LibraryStorageInfo {
  bookBytes: number
  usedBytes?: number
  quotaBytes?: number
  availableBytes?: number
  isLow: boolean
}

export class InsufficientStorageError extends Error {
  readonly requiredBytes: number
  readonly availableBytes: number

  constructor(requiredBytes: number, availableBytes: number) {
    super('浏览器存储空间不足。')
    this.name = 'InsufficientStorageError'
    this.requiredBytes = requiredBytes
    this.availableBytes = availableBytes
  }
}

let databasePromise: Promise<IDBDatabase> | undefined

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = (event) => {
      const database = request.result
      const upgradeTransaction = request.transaction!
      const bookStore = database.objectStoreNames.contains(BOOK_STORE)
        ? upgradeTransaction.objectStore(BOOK_STORE)
        : database.createObjectStore(BOOK_STORE, { keyPath: 'id' })

      if (!bookStore.indexNames.contains('addedAt')) {
        bookStore.createIndex('addedAt', 'addedAt')
      }
      if (!bookStore.indexNames.contains(FINGERPRINT_INDEX)) {
        bookStore.createIndex(FINGERPRINT_INDEX, FINGERPRINT_INDEX)
      }
      const fileStore = database.objectStoreNames.contains(FILE_STORE)
        ? upgradeTransaction.objectStore(FILE_STORE)
        : database.createObjectStore(FILE_STORE, { keyPath: 'id' })

      if (event.oldVersion < 3) {
        const cursorRequest = fileStore.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (cursor) {
            const file = cursor.value as BookFileRecord
            const bookRequest = bookStore.get(file.id) as IDBRequest<
              BookRecord | undefined
            >
            bookRequest.onsuccess = () => {
              if (!bookRequest.result) return
              bookStore.put({
                ...bookRequest.result,
                fileSize: file.data.byteLength,
              } satisfies BookRecord)
            }
            cursor.continue()
            return
          }
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return databasePromise
}

async function getBrowserStorageEstimate(): Promise<StorageEstimate> {
  try {
    return (await navigator.storage?.estimate()) ?? {}
  } catch {
    return {}
  }
}

export async function getLibraryStorageInfo(
  bookBytes: number,
): Promise<LibraryStorageInfo> {
  const estimate = await getBrowserStorageEstimate()
  const usedBytes = estimate.usage
  const quotaBytes = estimate.quota
  const availableBytes =
    usedBytes === undefined || quotaBytes === undefined
      ? undefined
      : Math.max(0, quotaBytes - usedBytes)
  const isLow =
    availableBytes !== undefined &&
    quotaBytes !== undefined &&
    (availableBytes < LOW_STORAGE_BYTES ||
      availableBytes / quotaBytes < LOW_STORAGE_RATIO)

  return {
    bookBytes,
    usedBytes,
    quotaBytes,
    availableBytes,
    isLow,
  }
}

export async function ensureStorageCapacity(requiredBytes: number): Promise<void> {
  if (requiredBytes <= 0) return
  const estimate = await getBrowserStorageEstimate()
  if (estimate.usage === undefined || estimate.quota === undefined) return

  const availableBytes = Math.max(0, estimate.quota - estimate.usage)
  const writeHeadroom = Math.min(
    Math.max(requiredBytes * 0.1, 1024 * 1024),
    32 * 1024 * 1024,
  )
  if (availableBytes < requiredBytes + writeHeadroom) {
    throw new InsufficientStorageError(requiredBytes, availableBytes)
  }
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.code === 22)
  )
}

export function getStorageErrorMessage(error: unknown): string | undefined {
  if (error instanceof InsufficientStorageError) {
    return '浏览器存储空间不足，无法添加这些书。请先删除不再需要的书，或释放设备空间后重试。'
  }
  if (isQuotaExceededError(error)) {
    return '浏览器存储空间已不足，写入未完成。请先删除不再需要的书，或释放设备空间后重试。'
  }
  return undefined
}

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

async function backfillBookFileSizes(
  books: BookRecord[],
): Promise<BookRecord[]> {
  const booksMissingSize = books.filter(
    (book) => !Number.isFinite(book.fileSize) || book.fileSize < 0,
  )
  if (booksMissingSize.length === 0) return books

  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  const files = await Promise.all(
    booksMissingSize.map((book) =>
      requestToPromise(
        fileStore.get(book.id) as IDBRequest<BookFileRecord | undefined>,
      ),
    ),
  )
  const sizesById = new Map(
    booksMissingSize.map((book, index) => [
      book.id,
      files[index]?.data.byteLength ?? 0,
    ]),
  )
  const updatedBooks = books.map((book) => {
    const fileSize = sizesById.get(book.id)
    if (fileSize === undefined) return book
    const updatedBook = { ...book, fileSize }
    bookStore.put(updatedBook)
    return updatedBook
  })
  await transactionComplete
  return updatedBooks
}

export async function getBooks(): Promise<BookRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction(BOOK_STORE, 'readonly')
  const books = await requestToPromise(
    transaction.objectStore(BOOK_STORE).getAll() as IDBRequest<BookRecord[]>,
  )

  const booksWithFileSizes = await backfillBookFileSizes(books)
  return [...booksWithFileSizes].sort(
    (left, right) =>
      (right.lastOpenedAt ?? right.addedAt) -
      (left.lastOpenedAt ?? left.addedAt),
  )
}

export async function getBookFile(id: string): Promise<ArrayBuffer | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readonly')
  const result = await requestToPromise(
    transaction.objectStore(FILE_STORE).get(id) as IDBRequest<
      BookFileRecord | undefined
    >,
  )
  return result?.data
}

export interface ImportedBookEntry {
  book: BookRecord & { fingerprint: string }
  data: ArrayBuffer
}

export interface DuplicateBookEntry {
  book: BookRecord
  existingBook: BookRecord
}

export interface SaveImportedBooksResult {
  imported: BookRecord[]
  duplicates: DuplicateBookEntry[]
}

async function getStoredBooksWithFingerprints(): Promise<BookRecord[]> {
  const entries = await getLibraryBackupEntries()
  const backfilled = await Promise.all(
    entries.map(async ({ book, data }) => {
      if (book.fingerprint) return book
      return { ...book, fingerprint: await createBookFingerprint(data) }
    }),
  )
  const booksToUpdate = backfilled.filter(
    (book, index) => book !== entries[index].book,
  )

  if (booksToUpdate.length > 0) {
    const database = await openDatabase()
    const transaction = database.transaction(BOOK_STORE, 'readwrite')
    const bookStore = transaction.objectStore(BOOK_STORE)
    for (const book of booksToUpdate) bookStore.put(book)
    await transactionToPromise(transaction)
  }

  return backfilled
}

async function getStoredFingerprintMap(): Promise<Map<string, BookRecord>> {
  const books = await getStoredBooksWithFingerprints()

  const booksByFingerprint = new Map<string, BookRecord>()
  for (const book of books) {
    if (book.fingerprint && !booksByFingerprint.has(book.fingerprint)) {
      booksByFingerprint.set(book.fingerprint, book)
    }
  }
  return booksByFingerprint
}

export async function saveImportedBooks(
  entries: ImportedBookEntry[],
): Promise<SaveImportedBooksResult> {
  if (entries.length === 0) return { imported: [], duplicates: [] }

  const booksByFingerprint = await getStoredFingerprintMap()
  const importedEntries: ImportedBookEntry[] = []
  const duplicates: DuplicateBookEntry[] = []

  for (const entry of entries) {
    const existingBook = booksByFingerprint.get(entry.book.fingerprint)
    if (existingBook) {
      duplicates.push({ book: entry.book, existingBook })
      continue
    }

    booksByFingerprint.set(entry.book.fingerprint, entry.book)
    importedEntries.push(entry)
  }

  if (importedEntries.length === 0) return { imported: [], duplicates }

  await ensureStorageCapacity(
    importedEntries.reduce((total, entry) => total + entry.data.byteLength, 0),
  )

  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  for (const { book, data } of importedEntries) {
    bookStore.put({ ...book, fileSize: data.byteLength } satisfies BookRecord)
    fileStore.put({ id: book.id, data } satisfies BookFileRecord)
  }
  await transactionToPromise(transaction)
  return {
    imported: importedEntries.map(({ book, data }) => ({
      ...book,
      fileSize: data.byteLength,
    })),
    duplicates,
  }
}

export async function deleteBook(
  id: string,
): Promise<DeletedBookEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  const [book, file] = await Promise.all([
    requestToPromise(
      bookStore.get(id) as IDBRequest<BookRecord | undefined>,
    ),
    requestToPromise(
      fileStore.get(id) as IDBRequest<BookFileRecord | undefined>,
    ),
  ])

  if (!book) {
    await transactionComplete
    return undefined
  }

  bookStore.delete(id)
  fileStore.delete(id)
  await transactionComplete
  return { book, data: file?.data }
}

export async function restoreDeletedBook(
  entry: DeletedBookEntry,
): Promise<void> {
  if (!entry.data) throw new Error('这本书的 EPUB 文件已经无法恢复。')

  const fingerprint =
    entry.book.fingerprint ?? (await createBookFingerprint(entry.data))
  const existingBook = (await getStoredFingerprintMap()).get(fingerprint)
  if (existingBook && existingBook.id !== entry.book.id) {
    throw new Error(`书架中已有《${existingBook.title}》，无法撤销删除。`)
  }

  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const fileStore = transaction.objectStore(FILE_STORE)
  transaction.objectStore(BOOK_STORE).put({
    ...entry.book,
    fingerprint,
    fileSize: entry.data.byteLength,
  } satisfies BookRecord)
  fileStore.put({
    id: entry.book.id,
    data: entry.data,
  } satisfies BookFileRecord)
  await transactionToPromise(transaction)
}

export async function getLibraryBackupEntries(): Promise<
  LibraryBackupEntry[]
> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readonly',
  )
  const transactionComplete = transactionToPromise(transaction)
  const booksRequest = transaction.objectStore(BOOK_STORE).getAll() as IDBRequest<
    BookRecord[]
  >
  const filesRequest = transaction.objectStore(FILE_STORE).getAll() as IDBRequest<
    BookFileRecord[]
  >
  const [books, files] = await Promise.all([
    requestToPromise(booksRequest),
    requestToPromise(filesRequest),
  ])
  await transactionComplete

  const filesById = new Map(files.map((file) => [file.id, file.data]))
  return books.map((book) => {
    const data = filesById.get(book.id)
    if (!data) throw new Error(`《${book.title}》的书籍文件已经丢失。`)
    return { book: { ...book, fileSize: data.byteLength }, data }
  })
}

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
      throw new Error(`请先选择《${entry.book.title}》的恢复方式。`)
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

export async function updateBookReadingState(
  id: string,
  state: Pick<BookRecord, 'progress' | 'location' | 'chapterLabel'>,
): Promise<BookRecord | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(BOOK_STORE, 'readwrite')
  const store = transaction.objectStore(BOOK_STORE)
  const existing = await requestToPromise(
    store.get(id) as IDBRequest<BookRecord | undefined>,
  )

  if (!existing) {
    transaction.abort()
    return undefined
  }

  const nextBook: BookRecord = {
    ...existing,
    ...state,
    lastOpenedAt: Date.now(),
  }
  store.put(nextBook)
  await transactionToPromise(transaction)
  return nextBook
}
