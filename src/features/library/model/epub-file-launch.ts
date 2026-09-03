export type EpubFileLaunchEvent =
  | { kind: 'files'; files: File[] }
  | { kind: 'error'; message: string }

type EpubFileLaunchListener = (event: EpubFileLaunchEvent) => void

interface EpubFileLaunchBridge {
  handleLaunch: (params: LaunchParams) => Promise<void>
  subscribe: (listener: EpubFileLaunchListener) => () => void
}

export function createEpubFileLaunchBridge(): EpubFileLaunchBridge {
  const listeners = new Set<EpubFileLaunchListener>()
  const pendingEvents: EpubFileLaunchEvent[] = []
  let readQueue = Promise.resolve()

  function publish(event: EpubFileLaunchEvent) {
    if (listeners.size === 0) {
      pendingEvents.push(event)
      return
    }
    for (const listener of listeners) listener(event)
  }

  function handleLaunch(params: LaunchParams): Promise<void> {
    const readFiles = async () => {
      if (params.files.length === 0) return

      try {
        const files = await Promise.all(
          params.files.map(async (handle) => {
            try {
              return await handle.getFile()
            } catch {
              throw new Error(`无法读取“${handle.name}”。`)
            }
          }),
        )
        publish({ kind: 'files', files })
      } catch (error) {
        publish({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : '无法读取系统交给卷舍的 EPUB 文件。',
        })
      }
    }

    const currentRead = readQueue.then(readFiles)
    readQueue = currentRead.catch(() => undefined)
    return currentRead
  }

  function subscribe(listener: EpubFileLaunchListener) {
    listeners.add(listener)
    const queuedEvents = pendingEvents.splice(0)
    for (const event of queuedEvents) listener(event)
    return () => listeners.delete(listener)
  }

  return { handleLaunch, subscribe }
}

const fileLaunchBridge = createEpubFileLaunchBridge()
let isInitialized = false

export function initializeEpubFileHandling(): void {
  if (isInitialized || __LENTO_BUILD_TARGET__ !== 'web') return
  const launchQueue = window.launchQueue
  if (!launchQueue) return

  isInitialized = true
  launchQueue.setConsumer((params) => {
    void fileLaunchBridge.handleLaunch(params)
  })
}

export function subscribeToEpubFileLaunch(
  listener: EpubFileLaunchListener,
): () => void {
  return fileLaunchBridge.subscribe(listener)
}
