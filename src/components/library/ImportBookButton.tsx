import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { getStorageErrorMessage } from '../../data/indexed-db/storage-capacity'
import type { LibraryAlertNotice } from './LibraryAlert'
import type { BookRecord } from '../../types/book'
import type { EpubImportResult } from '../../lib/import-epub'

interface UseBookImportResult {
  importFiles: (files: File[], options?: BookImportOptions) => Promise<void>
  isImporting: boolean
}

export interface BookImportOptions {
  openSingle?: boolean
}

function describeImportResult(result: EpubImportResult): LibraryAlertNotice {
  const importedCount = result.imported.length
  const duplicateCount = result.duplicates.length
  const failureCount = result.failures.length
  const parts: string[] = []

  if (importedCount > 0) parts.push(`已添加 ${importedCount} 本书`)
  if (duplicateCount > 0) parts.push(`跳过 ${duplicateCount} 本重复书`)
  if (failureCount > 0) parts.push(`${failureCount} 个文件未能导入`)

  const details = [
    ...result.duplicates.map(
      ({ fileName, existingTitle }) =>
        `${fileName}：与《${existingTitle}》内容相同`,
    ),
    ...result.failures.map(
      ({ fileName, message }) => `${fileName}：${message}`,
    ),
  ]

  return {
    kind: importedCount > 0 || duplicateCount > 0 ? 'success' : 'error',
    message: `${parts.join('，')}。`,
    detail: details.length > 0 ? details.slice(0, 3).join('；') : undefined,
  }
}

export function useBookImport(
  onImported: (books: BookRecord[]) => void,
  onAlert: (notice: LibraryAlertNotice | undefined) => void,
  onOpen: (id: string) => void,
): UseBookImportResult {
  const importQueueRef = useRef(Promise.resolve())
  const pendingImportCountRef = useRef(0)
  const [isImporting, setIsImporting] = useState(false)

  const importFiles = useCallback(
    (files: File[], options?: BookImportOptions) => {
      if (files.length === 0) return Promise.resolve()

      pendingImportCountRef.current += 1
      setIsImporting(true)
      const runImport = async () => {
        onAlert(undefined)
        try {
          const { importEpubFiles } = await import('../../lib/import-epub')
          const result = await importEpubFiles(files)
          if (result.imported.length > 0) onImported(result.imported)
          onAlert(describeImportResult(result))

          if (options?.openSingle && files.length === 1) {
            const bookId =
              result.imported[0]?.id ?? result.duplicates[0]?.existingBookId
            if (bookId) onOpen(bookId)
          }
        } catch (importError) {
          onAlert({
            kind: 'error',
            message:
              getStorageErrorMessage(importError) ??
              (importError instanceof Error
                ? importError.message
                : '添加书本失败。'),
          })
        } finally {
          pendingImportCountRef.current -= 1
          if (pendingImportCountRef.current === 0) setIsImporting(false)
        }
      }

      const queuedImport = importQueueRef.current.then(runImport)
      importQueueRef.current = queuedImport.catch(() => undefined)
      return queuedImport
    },
    [onAlert, onImported, onOpen],
  )

  return {
    importFiles,
    isImporting,
  }
}

interface ImportBookButtonProps {
  onFilesSelected: (files: File[]) => void
  isImporting: boolean
  compact?: boolean
}

export function ImportBookButton({
  onFilesSelected,
  isImporting,
  compact = false,
}: ImportBookButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    onFilesSelected(Array.from(files))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="import-control">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        className={compact ? 'secondary-button' : 'primary-button'}
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
      >
        <Plus aria-hidden="true" size={19} strokeWidth={1.7} />
        {isImporting ? '正在添加…' : '添加书本'}
      </button>
    </div>
  )
}
