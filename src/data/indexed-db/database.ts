import type { BookFileRecord, BookRecord } from '../../types/book'

export const BOOK_STORE = 'books'
export const FILE_STORE = 'files'
export const READING_ASSET_STORE = 'reading-assets'
export const FINGERPRINT_INDEX = 'fingerprint'
export const BOOK_ID_INDEX = 'bookId'

const DATABASE_NAME = 'lento-library'
const DATABASE_VERSION = 4
let databasePromise: Promise<IDBDatabase> | undefined

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function transactionToPromise(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export function openDatabase(): Promise<IDBDatabase> {
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

      const readingAssetStore = database.objectStoreNames.contains(
        READING_ASSET_STORE,
      )
        ? upgradeTransaction.objectStore(READING_ASSET_STORE)
        : database.createObjectStore(READING_ASSET_STORE, { keyPath: 'id' })
      if (!readingAssetStore.indexNames.contains(BOOK_ID_INDEX)) {
        readingAssetStore.createIndex(BOOK_ID_INDEX, BOOK_ID_INDEX)
      }

      if (event.oldVersion < 3) {
        const cursorRequest = fileStore.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor) return
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
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return databasePromise
}
