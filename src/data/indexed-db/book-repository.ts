import type {
  BookFileRecord,
  BookRecord,
  DeletedBookEntry,
  LibraryBackupEntry,
  ReadingAsset,
} from '../../types/book'
import { createBookFingerprint } from '../../lib/book-fingerprint'
import {
  getBookReadingStatus,
  normalizeBookTags,
} from '../../lib/book-organization'
import {
  BOOK_ID_INDEX,
  BOOK_STORE,
  FILE_STORE,
  openDatabase,
  READING_ASSET_STORE,
  requestToPromise,
  transactionToPromise,
} from './database'
import { ensureStorageCapacity } from './storage-capacity'

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

export async function getBookFile(
  id: string,
): Promise<ArrayBuffer | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(FILE_STORE, 'readonly')
  const result = await requestToPromise(
    transaction.objectStore(FILE_STORE).get(id) as IDBRequest<
      BookFileRecord | undefined
    >,
  )
  return result?.data
}

export async function getBookFileEntries(): Promise<LibraryBackupEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readonly',
  )
  const transactionComplete = transactionToPromise(transaction)
  const [books, files] = await Promise.all([
    requestToPromise(
      transaction.objectStore(BOOK_STORE).getAll() as IDBRequest<BookRecord[]>,
    ),
    requestToPromise(
      transaction.objectStore(FILE_STORE).getAll() as IDBRequest<
        BookFileRecord[]
      >,
    ),
  ])
  await transactionComplete

  const filesById = new Map(files.map((file) => [file.id, file.data]))
  return books.map((book) => {
    const data = filesById.get(book.id)
    if (!data) throw new Error(`《${book.title}》的书籍文件已经丢失。`)
    return { book: { ...book, fileSize: data.byteLength }, data }
  })
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

export async function getStoredBooksWithFingerprints(): Promise<BookRecord[]> {
  const entries = await getBookFileEntries()
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
    [BOOK_STORE, FILE_STORE, READING_ASSET_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  const readingAssetStore = transaction.objectStore(READING_ASSET_STORE)
  const [book, file, readingAssets] = await Promise.all([
    requestToPromise(
      bookStore.get(id) as IDBRequest<BookRecord | undefined>,
    ),
    requestToPromise(
      fileStore.get(id) as IDBRequest<BookFileRecord | undefined>,
    ),
    requestToPromise(
      readingAssetStore.index(BOOK_ID_INDEX).getAll(id) as IDBRequest<
        ReadingAsset[]
      >,
    ),
  ])

  if (!book) {
    await transactionComplete
    return undefined
  }

  bookStore.delete(id)
  fileStore.delete(id)
  for (const asset of readingAssets) readingAssetStore.delete(asset.id)
  await transactionComplete
  return { book, data: file?.data, readingAssets }
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
    [BOOK_STORE, FILE_STORE, READING_ASSET_STORE],
    'readwrite',
  )
  transaction.objectStore(BOOK_STORE).put({
    ...entry.book,
    fingerprint,
    fileSize: entry.data.byteLength,
  } satisfies BookRecord)
  transaction.objectStore(FILE_STORE).put({
    id: entry.book.id,
    data: entry.data,
  } satisfies BookFileRecord)
  const readingAssetStore = transaction.objectStore(READING_ASSET_STORE)
  for (const asset of entry.readingAssets ?? []) readingAssetStore.put(asset)
  await transactionToPromise(transaction)
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
    readingStatus:
      state.progress >= 0.995
        ? 'finished'
        : getBookReadingStatus(existing) === 'finished'
          ? 'finished'
          : 'reading',
  }
  store.put(nextBook)
  await transactionToPromise(transaction)
  return nextBook
}

export type BookOrganizationPatch = Partial<
  Pick<BookRecord, 'readingStatus' | 'isFavorite' | 'tags'>
>

export async function updateBookOrganization(
  id: string,
  patch: BookOrganizationPatch,
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
    ...patch,
    tags:
      patch.tags === undefined
        ? existing.tags
        : normalizeBookTags(patch.tags),
  }
  store.put(nextBook)
  await transactionToPromise(transaction)
  return nextBook
}
