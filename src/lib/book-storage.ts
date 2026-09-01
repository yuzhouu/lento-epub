import type {
  BookFileRecord,
  BookRecord,
  LibraryBackupEntry,
} from '../types/book'

const DATABASE_NAME = 'lento-library'
const DATABASE_VERSION = 1
const BOOK_STORE = 'books'
const FILE_STORE = 'files'

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
      if (!database.objectStoreNames.contains(BOOK_STORE)) {
        const bookStore = database.createObjectStore(BOOK_STORE, {
          keyPath: 'id',
        })
        bookStore.createIndex('addedAt', 'addedAt')
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

export async function saveImportedBook(
  book: BookRecord,
  data: ArrayBuffer,
): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [BOOK_STORE, FILE_STORE],
    'readwrite',
  )
  transaction.objectStore(BOOK_STORE).put(book)
  transaction.objectStore(FILE_STORE).put({ id: book.id, data })
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
