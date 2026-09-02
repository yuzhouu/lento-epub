import type { ReadingAsset, ReadingHighlight } from '../../types/book'
import {
  BOOK_ID_INDEX,
  openDatabase,
  READING_ASSET_STORE,
  requestToPromise,
  transactionToPromise,
} from './database'

function sortReadingAssets(assets: ReadingAsset[]): ReadingAsset[] {
  return [...assets].sort(
    (left, right) => right.createdAt - left.createdAt,
  )
}

export async function getReadingAssets(
  bookId: string,
): Promise<ReadingAsset[]> {
  const database = await openDatabase()
  const transaction = database.transaction(READING_ASSET_STORE, 'readonly')
  const assets = await requestToPromise(
    transaction.objectStore(READING_ASSET_STORE).index(BOOK_ID_INDEX).getAll(
      bookId,
    ) as IDBRequest<ReadingAsset[]>,
  )
  return sortReadingAssets(assets)
}

export async function saveReadingAsset(
  asset: ReadingAsset,
): Promise<ReadingAsset> {
  const database = await openDatabase()
  const transaction = database.transaction(READING_ASSET_STORE, 'readwrite')
  transaction.objectStore(READING_ASSET_STORE).put(asset)
  await transactionToPromise(transaction)
  return asset
}

export async function updateReadingHighlight(
  id: string,
  patch: Partial<
    Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note' | 'text'>
  >,
): Promise<ReadingHighlight | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(READING_ASSET_STORE, 'readwrite')
  const store = transaction.objectStore(READING_ASSET_STORE)
  const existing = await requestToPromise(
    store.get(id) as IDBRequest<ReadingAsset | undefined>,
  )
  if (!existing || existing.kind !== 'highlight') {
    transaction.abort()
    return undefined
  }

  const nextHighlight: ReadingHighlight = {
    ...existing,
    ...patch,
    note:
      patch.note === undefined
        ? existing.note
        : patch.note.trim() || undefined,
    updatedAt: Date.now(),
  }
  store.put(nextHighlight)
  await transactionToPromise(transaction)
  return nextHighlight
}

export async function deleteReadingAsset(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(READING_ASSET_STORE, 'readwrite')
  transaction.objectStore(READING_ASSET_STORE).delete(id)
  await transactionToPromise(transaction)
}
