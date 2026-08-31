import type { BookFileRecord, BookRecord } from '../types/book'

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
