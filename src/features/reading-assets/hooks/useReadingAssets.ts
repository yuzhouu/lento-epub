import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  deleteReadingAsset,
  saveReadingAsset,
  updateReadingHighlight,
} from '../../../data/indexed-db/reading-asset-repository'
import type {
  ReadingAsset,
  ReadingHighlight,
} from '../../../types/book'

export function useReadingAssets(bookId: string) {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<ReadingAsset[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string>()
  const [activeAssetFocusVersion, setActiveAssetFocusVersion] = useState(0)
  const [isSavingBookmark, setIsSavingBookmark] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    setAssets([])
    setActiveAssetId(undefined)
    setActiveAssetFocusVersion(0)
    setError(undefined)
  }, [bookId])

  async function create(asset: ReadingAsset): Promise<ReadingAsset | undefined> {
    setError(undefined)
    try {
      const saved = await saveReadingAsset(asset)
      setAssets((current) => [saved, ...current])
      return saved
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('errors.saveReadingAsset'))
      return undefined
    }
  }

  async function update(
    highlight: ReadingHighlight,
    patch: Partial<Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note' | 'text'>>,
  ): Promise<ReadingHighlight | undefined> {
    setError(undefined)
    try {
      const updated = await updateReadingHighlight(highlight.id, patch)
      if (!updated) throw new Error(t('errors.assetMissing'))
      setAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      return updated
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('errors.updateHighlight'))
      return undefined
    }
  }

  async function remove(asset: ReadingAsset): Promise<boolean> {
    setError(undefined)
    try {
      await deleteReadingAsset(asset.id)
      setAssets((current) =>
        current.filter((currentAsset) => currentAsset.id !== asset.id),
      )
      setActiveAssetId((current) =>
        current === asset.id ? undefined : current,
      )
      return true
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t('errors.deleteReadingAsset'),
      )
      return false
    }
  }

  async function toggleBookmark(
    currentBookmark: ReadingAsset | undefined,
    createBookmark: () => ReadingAsset,
  ): Promise<boolean> {
    if (isSavingBookmark) return false
    setIsSavingBookmark(true)
    setError(undefined)
    try {
      if (currentBookmark) {
        await deleteReadingAsset(currentBookmark.id)
        setAssets((current) =>
          current.filter((asset) => asset.id !== currentBookmark.id),
        )
      } else {
        const bookmark = createBookmark()
        await saveReadingAsset(bookmark)
        setAssets((current) => [bookmark, ...current])
      }
      return true
    } catch (bookmarkError) {
      setError(
        bookmarkError instanceof Error
          ? bookmarkError.message
          : t('errors.saveBookmark'),
      )
      return false
    } finally {
      setIsSavingBookmark(false)
    }
  }

  function focus(assetId: string) {
    setActiveAssetId(assetId)
    setActiveAssetFocusVersion((version) => version + 1)
  }

  return {
    assets,
    activeAssetId,
    activeAssetFocusVersion,
    isSavingBookmark,
    error,
    setAssets,
    setActiveAssetId,
    setError,
    create,
    update,
    remove,
    toggleBookmark,
    focus,
  }
}
