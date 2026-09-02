import { useEffect, useState, type FormEvent } from 'react'
import {
  BookOpen,
  PanelRightClose,
  Plus,
  Star,
  X,
} from 'lucide-react'
import {
  BOOK_READING_STATUS_LABELS,
  BOOK_READING_STATUSES,
  getBookReadingStatus,
  MAX_BOOK_TAG_LENGTH,
  MAX_BOOK_TAGS,
} from '../../lib/book-organization'
import type { BookOrganizationPatch } from '../../lib/book-storage'
import type { BookRecord } from '../../types/book'

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
  const [tagDraft, setTagDraft] = useState('')
  const [tagError, setTagError] = useState<string>()
  const [isUpdating, setIsUpdating] = useState(false)
  const tags = book.tags ?? []
  const readingStatus = getBookReadingStatus(book)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
      setTagError('请输入标签名称。')
      return
    }
    if (tag.length > MAX_BOOK_TAG_LENGTH) {
      setTagError(`标签最多 ${MAX_BOOK_TAG_LENGTH} 个字。`)
      return
    }
    if (tags.length >= MAX_BOOK_TAGS) {
      setTagError(`每本书最多 ${MAX_BOOK_TAGS} 个标签。`)
      return
    }
    if (
      tags.some(
        (current) =>
          current.toLocaleLowerCase('zh-CN') ===
          tag.toLocaleLowerCase('zh-CN'),
      )
    ) {
      setTagError('这本书已有该标签。')
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

  return (
    <>
      <button
        className="book-sidebar-scrim"
        type="button"
        aria-label="关闭书籍信息"
        onClick={onClose}
      />
      <aside
        id="book-details-sidebar"
        className="book-details-sidebar"
        aria-labelledby="book-details-title"
      >
        <header className="book-details-heading">
          <div>
            <span>书籍信息</span>
            <h2 id="book-details-title">管理这本书</h2>
          </div>
          <button type="button" aria-label="关闭书籍信息" onClick={onClose}>
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
            <span>已阅读 {Math.round(book.progress * 100)}%</span>
          </div>
        </div>

        <section className="book-details-section" aria-labelledby="book-status-title">
          <div className="book-details-section-heading">
            <h3 id="book-status-title">阅读状态</h3>
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
                {BOOK_READING_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </section>

        <section
          className="book-details-section"
          aria-labelledby="book-favorite-title"
        >
          <div className="book-details-section-heading">
            <h3 id="book-favorite-title">收藏</h3>
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
              <strong>{book.isFavorite ? '已收藏' : '加入收藏'}</strong>
              <small>在书架中快速筛选这本书</small>
            </span>
          </button>
        </section>

        <section
          className="book-details-section"
          aria-labelledby="book-tags-title"
        >
          <div className="book-details-section-heading">
            <h3 id="book-tags-title">标签</h3>
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
                    aria-label={`移除标签 ${tag}`}
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
              添加标签，之后可以从书架顶部快速筛选。
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
              placeholder="输入新标签"
              aria-label={`为《${book.title}》添加标签`}
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
              添加
            </button>
          </form>
          {tagError ? (
            <p className="book-sidebar-error" role="alert">
              {tagError}
            </p>
          ) : null}
          <p className="book-sidebar-tag-limit">
            每个标签最多 {MAX_BOOK_TAG_LENGTH} 个字
          </p>
        </section>
      </aside>
    </>
  )
}
