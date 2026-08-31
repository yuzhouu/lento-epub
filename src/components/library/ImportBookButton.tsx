import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { BookRecord } from '../../types/book'

interface ImportBookButtonProps {
  onImported: (book: BookRecord) => void
  compact?: boolean
}

export function ImportBookButton({
  onImported,
  compact = false,
}: ImportBookButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string>()

  async function handleFile(file: File | undefined) {
    if (!file) return
    setIsImporting(true)
    setError(undefined)

    try {
      const { importEpub } = await import('../../lib/import-epub')
      onImported(await importEpub(file))
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : '添加书本失败。',
      )
    } finally {
      setIsImporting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="import-control">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,application/epub+zip"
        onChange={(event) => void handleFile(event.target.files?.[0])}
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
      {error ? (
        <p className="import-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
