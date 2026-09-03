/// <reference types="vite/client" />

declare const __LENTO_BUILD_TARGET__: 'web' | 'extension'

interface LaunchParams {
  readonly files: readonly FileSystemFileHandle[]
  readonly targetURL: string | null
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void
}

interface Window {
  readonly launchQueue?: LaunchQueue
}
