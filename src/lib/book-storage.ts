import type {
  BookFileRecord,
  BookRecord,
  DeletedBookEntry,
  LibraryBackupEntry,
} from '../types/book'
import { createBookFingerprint } from './book-fingerprint'

const DATABASE_NAME = 'lento-library'
const DATABASE_VERSION = 2
const BOOK_STORE = 'books'
const FILE_STORE = 'files'
const FINGERPRINT_INDEX = 'fingerprint'

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

    request.onupgradeneeded = () => {
      const database = request.result
      const bookStore = database.objectStoreNames.contains(BOOK_STORE)
        ? request.transaction!.objectStore(BOOK_STORE)
        : database.createObjectStore(BOOK_STORE, { keyPath: 'id' })

      if (!bookStore.indexNames.contains('addedAt')) {
        bookStore.createIndex('addedAt', 'addedAt')
      }
      if (!bookStore.indexNames.contains(FINGERPRINT_INDEX)) {
        bookStore.createIndex(FINGERPRINT_INDEX, FINGERPRINT_INDEX)
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        database.createObjectStore(FILE_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return databasePromise
}

export async function getBooks(): Promise<BookRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction(BOOK_STORE, 'readonly')
  const books = await requestToPromise(
    transaction.objectStore(BOOK_STORE).getAll() as IDBRequest<BookRecord[]>,
  )

  return [...books].sort(
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

async function getStoredFingerprintMap(): Promise<Map<string, BookRecord>> {
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

  const booksByFingerprint = new Map<string, BookRecord>()
  for (const book of backfilled) {
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

  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)
  for (const { book, data } of importedEntries) {
    bookStore.put(book)
    fileStore.put({ id: book.id, data } satisfies BookFileRecord)
  }
  await transactionToPromise(transaction)
  return {
    imported: importedEntries.map(({ book }) => book),
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
  transaction.objectStore(BOOK_STORE).put({
    ...entry.book,
    fingerprint,
  } satisfies BookRecord)
  transaction.objectStore(FILE_STORE).put({
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
    return { book, data }
  })
}

export async function restoreLibraryBackupEntries(
  entries: LibraryBackupEntry[],
): Promise<BookRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const bookStore = transaction.objectStore(BOOK_STORE)
  const fileStore = transaction.objectStore(FILE_STORE)

  for (const { book, data } of entries) {
    bookStore.put(book)
    fileStore.put({ id: book.id, data } satisfies BookFileRecord)
  }

  await transactionComplete
  return getBooks()
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
