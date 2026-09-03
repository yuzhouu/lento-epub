import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Download,
  PanelRightClose,
  Plus,
  Star,
  X,
} from 'lucide-react'
import {
  BOOK_READING_STATUS_KEYS,
  BOOK_READING_STATUSES,
  getBookReadingStatus,
  MAX_BOOK_TAG_LENGTH,
  MAX_BOOK_TAGS,
} from '../../lib/book-organization'
import { getReadingAssets } from '../../data/indexed-db/reading-asset-repository'
import type { BookOrganizationPatch } from '../../data/indexed-db/book-repository'
import type { BookRecord, ReadingAsset } from '../../types/book'
import type { ReadingAssetExportFormat } from '../../lib/reading-asset-export'

interface BookDetailsSidebarProps {
  book: BookRecord
  onClose: () => void
  onUpdate: (id: string, patch: BookOrganizationPatch) => Promise<void>
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function BookDetailsSidebar({
  book,
  onClose,
  onUpdate,
}: BookDetailsSidebarProps) {
  const { t } = useTranslation()
  const [tagDraft, setTagDraft] = useState('')
  const [tagError, setTagError] = useState<string>()
  const [isUpdating, setIsUpdating] = useState(false)
  const [readingAssets, setReadingAssets] = useState<ReadingAsset[]>()
  const [readingAssetsError, setReadingAssetsError] = useState<string>()
  const [exportingFormat, setExportingFormat] =
    useState<ReadingAssetExportFormat>()
  const tags = book.tags ?? []
  const readingStatus = getBookReadingStatus(book)
  const bookmarkCount =
    readingAssets?.filter((asset) => asset.kind === 'bookmark').length ?? 0
  const highlightCount = (readingAssets?.length ?? 0) - bookmarkCount

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    void getReadingAssets(book.id)
      .then((assets) => {
        if (!cancelled) setReadingAssets(assets)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setReadingAssetsError(
          loadError instanceof Error
            ? loadError.message
            : t('library.details.loadRecordsFailed'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [book.id, t])

  async function saveOrganization(
    patch: BookOrganizationPatch,
  ): Promise<boolean> {
    if (isUpdating) return false
    setIsUpdating(true)
    try {
      await onUpdate(book.id, patch)
      return true
    } catch {
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleAddTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const tag = normalizeTag(tagDraft)
    if (!tag) {
      setTagError(t('library.details.tagRequired'))
      return
    }
    if (tag.length > MAX_BOOK_TAG_LENGTH) {
      setTagError(t('library.details.tagTooLong', { count: MAX_BOOK_TAG_LENGTH }))
      return
    }
    if (tags.length >= MAX_BOOK_TAGS) {
      setTagError(t('library.details.tooManyTags', { count: MAX_BOOK_TAGS }))
      return
    }
    if (
      tags.some(
        (current) =>
          current.toLocaleLowerCase('zh-CN') ===
          tag.toLocaleLowerCase('zh-CN'),
      )
    ) {
      setTagError(t('library.details.duplicateTag'))
      return
    }

    setTagError(undefined)
    if (await saveOrganization({ tags: [...tags, tag] })) setTagDraft('')
  }

  async function handleRemoveTag(tagToRemove: string) {
    setTagError(undefined)
    await saveOrganization({
      tags: tags.filter((tag) => tag !== tagToRemove),
    })
  }

  async function handleExport(format: ReadingAssetExportFormat) {
    if (!readingAssets?.length || exportingFormat) return
    setExportingFormat(format)
    setReadingAssetsError(undefined)
    try {
      const { downloadReadingAssets } = await import(
        '../../lib/reading-asset-export'
      )
      downloadReadingAssets(book, readingAssets, format)
    } catch (exportError) {
      setReadingAssetsError(
        exportError instanceof Error
          ? exportError.message
          : t('library.details.exportRecordsFailed'),
      )
    } finally {
      setExportingFormat(undefined)
    }
  }

  return (
    <>
      <button
        className="book-sidebar-scrim"
        type="button"
        aria-label={t('library.details.close')}
        onClick={onClose}
      />
      <aside
        id="book-details-sidebar"
        className="book-details-sidebar"
        aria-labelledby="book-details-title"
      >
        <header className="book-details-heading">
          <div>
            <span>{t('library.details.eyebrow')}</span>
            <h2 id="book-details-title">{t('library.details.title')}</h2>
          </div>
          <button type="button" aria-label={t('library.details.close')} onClick={onClose}>
            <PanelRightClose aria-hidden="true" size={18} strokeWidth={1.6} />
          </button>
        </header>

        <div className="book-details-summary">
          <div className="book-details-cover" aria-hidden="true">
            {book.coverDataUrl ? (
              <img src={book.coverDataUrl} alt="" />
            ) : (
              <BookOpen size={25} strokeWidth={1.35} />
            )}
          </div>
          <div>
            <h3>{book.title}</h3>
            <p>{book.author}</p>
            <span>{t('library.details.readProgress', { percent: Math.round(book.progress * 100) })}</span>
          </div>
        </div>

        <section className="book-details-section" aria-labelledby="book-status-title">
          <div className="book-details-section-heading">
            <h3 id="book-status-title">{t('library.details.status')}</h3>
          </div>
          <div className="book-sidebar-status-options">
            {BOOK_READING_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={readingStatus === status ? 'is-active' : ''}
                aria-pressed={readingStatus === status}
                disabled={isUpdating}
                onClick={() =>
                  void saveOrganization({ readingStatus: status })
                }
              >
                {t(BOOK_READING_STATUS_KEYS[status])}
              </button>
            ))}
          </div>
        </section>

        <section
          className="book-details-section"
          aria-labelledby="book-favorite-title"
        >
          <div className="book-details-section-heading">
            <h3 id="book-favorite-title">{t('common.favorite')}</h3>
          </div>
          <button
            className={`book-sidebar-favorite${
              book.isFavorite ? ' is-active' : ''
            }`}
            type="button"
            aria-pressed={Boolean(book.isFavorite)}
            disabled={isUpdating}
            onClick={() =>
              void saveOrganization({ isFavorite: !book.isFavorite })
            }
          >
            <Star
              aria-hidden="true"
              size={17}
              strokeWidth={1.65}
              fill={book.isFavorite ? 'currentColor' : 'none'}
            />
            <span>
              <strong>{book.isFavorite ? t('library.book.favorited') : t('library.details.addFavorite')}</strong>
              <small>{t('library.details.favoriteHint')}</small>
            </span>
          </button>
        </section>

        <section
          className="book-details-section"
          aria-labelledby="book-reading-assets-title"
        >
          <div className="book-details-section-heading">
            <h3 id="book-reading-assets-title">{t('library.details.exportTitle')}</h3>
            <span>
              {readingAssets
                ? t('library.details.records', { count: readingAssets.length })
                : readingAssetsError
                  ? t('common.loadFailed')
                  : t('common.loading')}
            </span>
          </div>
          <p className="book-sidebar-export-summary">
            {readingAssets?.length
              ? t('library.details.exportSummary', { bookmarks: bookmarkCount, highlights: highlightCount })
              : readingAssets
                ? t('library.details.noRecords')
                : readingAssetsError
                  ? t('library.details.recordsUnavailable')
                  : t('library.details.preparingRecords')}
          </p>
          <div className="book-sidebar-export-actions" aria-label={t('library.details.exportFormat')}>
            <button
              type="button"
              disabled={!readingAssets?.length || Boolean(exportingFormat)}
              onClick={() => void handleExport('markdown')}
            >
              <Download aria-hidden="true" size={14} strokeWidth={1.7} />
              {exportingFormat === 'markdown' ? t('library.details.exporting') : 'Markdown'}
            </button>
            <button
              type="button"
              disabled={!readingAssets?.length || Boolean(exportingFormat)}
              onClick={() => void handleExport('text')}
            >
              <Download aria-hidden="true" size={14} strokeWidth={1.7} />
              {exportingFormat === 'text' ? t('library.details.exporting') : t('library.details.plainText')}
            </button>
          </div>
          {readingAssetsError ? (
            <p className="book-sidebar-export-error" role="alert">
              {readingAssetsError}
            </p>
          ) : null}
        </section>

        <section
          className="book-details-section"
          aria-labelledby="book-tags-title"
        >
          <div className="book-details-section-heading">
            <h3 id="book-tags-title">{t('library.details.tags')}</h3>
            <span>
              {tags.length} / {MAX_BOOK_TAGS}
            </span>
          </div>

          {tags.length ? (
            <div className="book-sidebar-tags">
              {tags.map((tag) => (
                <span key={tag}>
                  {tag}
                  <button
                    type="button"
                    aria-label={t('library.details.removeTag', { tag })}
                    disabled={isUpdating}
                    onClick={() => void handleRemoveTag(tag)}
                  >
                    <X aria-hidden="true" size={12} strokeWidth={1.9} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="book-sidebar-tags-empty">
              {t('library.details.noTags')}
            </p>
          )}

          <form
            className="book-sidebar-tag-form"
            onSubmit={(event) => void handleAddTag(event)}
          >
            <input
              type="text"
              value={tagDraft}
              maxLength={MAX_BOOK_TAG_LENGTH + 1}
              placeholder={t('library.details.newTag')}
              aria-label={t('library.details.addTagLabel', { title: book.title })}
              disabled={isUpdating || tags.length >= MAX_BOOK_TAGS}
              onChange={(event) => {
                setTagDraft(event.target.value)
                setTagError(undefined)
              }}
            />
            <button
              type="submit"
              disabled={isUpdating || tags.length >= MAX_BOOK_TAGS}
            >
              <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
              {t('common.add')}
            </button>
          </form>
          {tagError ? (
            <p className="book-sidebar-error" role="alert">
              {tagError}
            </p>
          ) : null}
          <p className="book-sidebar-tag-limit">
            {t('library.details.tagLimit', { count: MAX_BOOK_TAG_LENGTH })}
          </p>
        </section>
      </aside>
    </>
  )
}
