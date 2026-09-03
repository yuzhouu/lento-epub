import i18n from '../../i18n'

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
    super(i18n.t('dataErrors.storageFull'))
    this.name = 'InsufficientStorageError'
    this.requiredBytes = requiredBytes
    this.availableBytes = availableBytes
  }
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

export async function ensureStorageCapacity(
  requiredBytes: number,
): Promise<void> {
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
    return i18n.t('dataErrors.storageInsufficient')
  }
  if (isQuotaExceededError(error)) {
    return i18n.t('dataErrors.storageWriteFailed')
  }
  return undefined
}
