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
    return '浏览器存储空间不足，无法添加这些书。请先删除不再需要的书，或释放设备空间后重试。'
  }
  if (isQuotaExceededError(error)) {
    return '浏览器存储空间已不足，写入未完成。请先删除不再需要的书，或释放设备空间后重试。'
  }
  return undefined
}
