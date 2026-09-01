import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { BookRecord } from '../../types/book'
import type { EpubImportResult } from '../../lib/import-epub'

export interface ImportNotice {
  kind: 'success' | 'error'
  message: string
  detail?: string
}

interface UseBookImportResult {
  importFiles: (files: File[]) => Promise<void>
  isImporting: boolean
  notice?: ImportNotice
  clearNotice: () => void
}

function describeImportResult(result: EpubImportResult): ImportNotice {
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
): UseBookImportResult {
  const importingRef = useRef(false)
  const [isImporting, setIsImporting] = useState(false)
  const [notice, setNotice] = useState<ImportNotice>()

  const importFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || importingRef.current) return

      importingRef.current = true
      setIsImporting(true)
      setNotice(undefined)
      try {
        const { importEpubFiles } = await import('../../lib/import-epub')
        const result = await importEpubFiles(files)
        if (result.imported.length > 0) onImported(result.imported)
        setNotice(describeImportResult(result))
      } catch (importError) {
        setNotice({
          kind: 'error',
          message:
            importError instanceof Error
              ? importError.message
              : '添加书本失败。',
        })
      } finally {
        importingRef.current = false
        setIsImporting(false)
      }
    },
    [onImported],
  )

  return {
    importFiles,
    isImporting,
    notice,
    clearNotice: () => setNotice(undefined),
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
