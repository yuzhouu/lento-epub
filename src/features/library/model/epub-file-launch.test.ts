import { describe, expect, it } from 'vitest'
import i18n from '../../../i18n'
import { createEpubFileLaunchBridge } from './epub-file-launch'

function createHandle(file: File): FileSystemFileHandle {
  return {
    kind: 'file',
    name: file.name,
    getFile: async () => file,
  } as FileSystemFileHandle
}

function createParams(handles: FileSystemFileHandle[]): LaunchParams {
  return { files: handles, targetURL: null }
}

describe('EPUB PWA file launches', () => {
  it('keeps a cold-start launch until the app subscribes', async () => {
    const bridge = createEpubFileLaunchBridge()
    const book = new File(['book'], '山川.epub', {
      type: 'application/epub+zip',
    })

    await bridge.handleLaunch(createParams([createHandle(book)]))

    const events: unknown[] = []
    bridge.subscribe((event) => events.push(event))
    expect(events).toEqual([{ kind: 'files', files: [book] }])
  })

  it('reports a file handle that can no longer be read', async () => {
    const bridge = createEpubFileLaunchBridge()
    const events: unknown[] = []
    bridge.subscribe((event) => events.push(event))
    const unreadableHandle = {
      kind: 'file',
      name: '丢失.epub',
      getFile: async () => {
        throw new DOMException('Not found', 'NotFoundError')
      },
    } as unknown as FileSystemFileHandle

    await bridge.handleLaunch(createParams([unreadableHandle]))

    expect(events).toEqual([
      {
        kind: 'error',
        message: i18n.t('dataErrors.launchRead', { name: '丢失.epub' }),
      },
    ])
  })
})
