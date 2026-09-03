import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  saveReadingAsset,
  updateReadingHighlight,
} from '../../data/indexed-db/reading-asset-repository'
import {
  NOTE_HIGHLIGHT_COLOR,
} from '../../lib/reading-highlight-colors'
import {
  DEFAULT_READING_HIGHLIGHT_STYLE,
} from '../../lib/reading-highlight-styles'
import {
  BookSearchPanel,
  type BookSearchResult,
} from './BookSearchPanel'
import { TocPanel } from './TocPanel'
import { ReadingAssetsPanel } from './ReadingAssetsPanel'
import type {
  BookRecord,
  ReadingAsset,
  ReadingHighlight,
  ReadingHighlightColor,
  ReadingHighlightStyle,
} from '../../types/book'
import { useReaderPreferences } from '../../features/reader/hooks/useReaderPreferences'
import type { ReaderFlow } from '../../features/reader/model/reader-preferences'
import {
  findChapterNeighbors,
} from '../../features/reader/epub/epub-navigation'
import { renderReadingHighlight } from '../../features/reader/epub/epub-annotations'
import { READER_WIDTHS } from '../../features/reader/epub/epub-theme'
import {
  SelectionEditor,
  type PendingSelection,
} from '../../features/reading-assets/components/SelectionEditor'
import { ReaderHeader } from '../../features/reader/components/ReaderHeader'
import { ReaderFooter } from '../../features/reader/components/ReaderFooter'
import { ReaderStage } from '../../features/reader/components/ReaderStage'
import type { NavigationPanel } from '../../features/reader/model/reader-navigation'
import { useReadingAssets } from '../../features/reading-assets/hooks/useReadingAssets'
import { useEpubSearch } from '../../features/reader/hooks/useEpubSearch'
import {
  useEpubReader,
  type EpubTextSelection,
} from '../../features/reader/hooks/useEpubReader'

interface ReaderPageProps {
  bookRecord: BookRecord
  onBack: () => void
  onBookUpdate: (book: BookRecord) => void
}

export function ReaderPage({
  bookRecord,
  onBack,
  onBookUpdate,
}: ReaderPageProps) {
  const preferences = useReaderPreferences()
  const {
    font,
    fontSize,
    flow: readerFlow,
    lineHeight,
    readerWidth,
    paragraphStyle,
    clickPagination,
    theme,
    setFlow: setReaderFlow,
  } = preferences
  const readingAssetController = useReadingAssets(bookRecord.id)
  const {
    assets: readingAssets,
    activeAssetId,
    activeAssetFocusVersion,
    isSavingBookmark,
    error: readingAssetError,
    setAssets: setReadingAssets,
    setActiveAssetId,
    setError: setReadingAssetError,
  } = readingAssetController
  const settingsAnchorRef = useRef<HTMLDivElement>(null)
  const pendingSelectionRef = useRef<PendingSelection | undefined>(undefined)
  const pendingSelectionWindowRef = useRef<Window | undefined>(undefined)
  const pendingNoteRef = useRef('')
  const pendingNoteDirtyRef = useRef(false)
  const pendingNoteSaveTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const pendingColorRef = useRef<ReadingHighlightColor | undefined>(undefined)
  const pendingLineStyleRef = useRef<ReadingHighlightStyle>(
    DEFAULT_READING_HIGHLIGHT_STYLE,
  )
  const pendingLineStyleDirtyRef = useRef(false)
  const pendingExistingHighlightRef = useRef<ReadingHighlight | undefined>(
    undefined,
  )
  const pendingSelectionVersionRef = useRef(0)
  const isSavingSelectionRef = useRef(false)
  const closePendingSelectionAfterSaveRef = useRef(false)
  const selectionDraftsRef = useRef<Map<string, string>>(new Map())
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 980)
  const [navigationPanel, setNavigationPanel] =
    useState<NavigationPanel>('toc')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>()
  const [pendingNote, setPendingNote] = useState('')
  const [pendingColor, setPendingColor] = useState<ReadingHighlightColor>()
  const [pendingLineStyle, setPendingLineStyle] =
    useState<ReadingHighlightStyle>(DEFAULT_READING_HIGHLIGHT_STYLE)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const tocOpenRef = useRef(tocOpen)
  const navigationPanelRef = useRef(navigationPanel)

  pendingNoteRef.current = pendingNote
  pendingColorRef.current = pendingColor
  pendingLineStyleRef.current = pendingLineStyle
  tocOpenRef.current = tocOpen
  navigationPanelRef.current = navigationPanel

  const reader = useEpubReader({
    bookRecord,
    preferences,
    onBookUpdate,
    onBookChanged: () => {
      cancelPendingSelection()
      selectionDraftsRef.current.clear()
      setReadingAssets([])
      setActiveAssetId(undefined)
    },
    onAssetsLoaded: setReadingAssets,
    onSearchSourceReady: (data) => epubSearch.setSource(data),
    onHighlightOpen: handleReadingHighlightOpen,
    onTextSelected: handleEpubTextSelected,
    hasPendingSelection: () => Boolean(pendingSelectionRef.current),
    onDismissPendingSelection: dismissPendingSelection,
    onContentPointerDown: () => {
      setSettingsOpen(false)
      dismissPendingSelection()
    },
    onSearchRequested: () => {
      dismissPendingSelection()
      setSettingsOpen(false)
      setNavigationPanel('search')
      setTocOpen(true)
    },
    onPageTurn: (direction) => {
      if (direction === 'previous') handleBackward()
      else handleForward()
    },
  })
  const epubSearch = useEpubSearch(bookRecord.id, reader.toc)
  const {
    viewerRef,
    renditionRef,
    currentLocationRef,
    toc,
    currentHref,
    chapterLabel,
    chapterProgress,
    chapterScrollSize,
    chapterViewportSize,
    atChapterStart,
    atChapterEnd,
    isOpening,
    openingMessage,
    error,
    resetChapterBoundary,
    displayChapter: displayReaderChapter,
    scrollChapterToProgress,
  } = reader

  useEffect(() => {
    return clearPendingNoteSaveTimer
  }, [bookRecord.id])

  useEffect(() => {
    if (!settingsOpen) return

    function closeSettingsOutside(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        settingsAnchorRef.current?.contains(target)
      ) {
        return
      }
      setSettingsOpen(false)
    }

    document.addEventListener('pointerdown', closeSettingsOutside)
    return () => {
      document.removeEventListener('pointerdown', closeSettingsOutside)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!pendingSelection) return

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('.selection-editor')
      ) {
        return
      }
      dismissPendingSelection()
    }

    function handlePendingSelectionKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismissPendingSelection()
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    document.addEventListener('keydown', handlePendingSelectionKeyDown)
    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true,
      )
      document.removeEventListener('keydown', handlePendingSelectionKeyDown)
    }
  }, [pendingSelection?.cfi])

  function handleEpubTextSelected(selection: EpubTextSelection) {
    replacePendingSelection(selection.contentWindow)
    const draft = selectionDraftsRef.current.get(selection.cfi)
    const nextSelection: PendingSelection = {
      cfi: selection.cfi,
      text: selection.text,
      href: selection.href,
      chapterLabel: selection.chapterLabel,
    }
    const nextNote = draft ?? ''
    pendingSelectionRef.current = nextSelection
    pendingSelectionWindowRef.current = selection.contentWindow
    pendingNoteRef.current = nextNote
    pendingNoteDirtyRef.current = Boolean(nextNote.trim())
    pendingColorRef.current = undefined
    pendingLineStyleRef.current = DEFAULT_READING_HIGHLIGHT_STYLE
    pendingLineStyleDirtyRef.current = false
    pendingExistingHighlightRef.current = undefined
    pendingSelectionVersionRef.current += 1
    setPendingNote(nextNote)
    setPendingColor(undefined)
    setPendingLineStyle(DEFAULT_READING_HIGHLIGHT_STYLE)
    setPendingSelection(nextSelection)
  }

  function handleReadingHighlightOpen(highlight: ReadingHighlight) {
    setReadingAssetError(undefined)
    setSettingsOpen(false)
    if (
      tocOpenRef.current &&
      navigationPanelRef.current === 'assets'
    ) {
      readingAssetController.focus(highlight.id)
      dismissPendingSelection()
      return
    }

    setActiveAssetId(highlight.id)
    openReadingHighlightEditor(highlight)
  }

  function openReadingHighlightEditor(highlight: ReadingHighlight) {
    try {
      pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
    } catch {
      // The previous content document may have unloaded during navigation.
    }

    const nextSelection: PendingSelection = {
      cfi: highlight.cfi,
      text: highlight.text,
      href: highlight.href,
      chapterLabel: highlight.chapterLabel,
    }
    selectionDraftsRef.current.delete(highlight.cfi)
    pendingSelectionRef.current = nextSelection
    pendingSelectionWindowRef.current = undefined
    pendingNoteRef.current = highlight.note ?? ''
    pendingNoteDirtyRef.current = false
    pendingColorRef.current = highlight.color
    pendingLineStyleRef.current =
      highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE
    pendingLineStyleDirtyRef.current = false
    pendingExistingHighlightRef.current = highlight
    pendingSelectionVersionRef.current += 1
    setPendingSelection(nextSelection)
    setPendingNote(highlight.note ?? '')
    setPendingColor(highlight.color)
    setPendingLineStyle(
      highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE,
    )
  }

  function resetPendingSelection(options: {
    preserveDraft: boolean
    clearNativeSelection: boolean
  }) {
    clearPendingNoteSaveTimer()
    const pending = pendingSelectionRef.current
    if (!pending) return

    const note = pendingNoteRef.current.trim()
    if (
      options.preserveDraft &&
      note &&
      !pendingExistingHighlightRef.current
    ) {
      selectionDraftsRef.current.set(pending.cfi, note)
    } else {
      selectionDraftsRef.current.delete(pending.cfi)
    }

    if (options.clearNativeSelection) {
      try {
        pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
      } catch {
        // The content document may already have been unloaded after navigation.
      }
    }
    pendingSelectionRef.current = undefined
    pendingSelectionWindowRef.current = undefined
    pendingNoteRef.current = ''
    pendingNoteDirtyRef.current = false
    pendingColorRef.current = undefined
    pendingLineStyleRef.current = DEFAULT_READING_HIGHLIGHT_STYLE
    pendingLineStyleDirtyRef.current = false
    pendingExistingHighlightRef.current = undefined
    closePendingSelectionAfterSaveRef.current = false
    pendingSelectionVersionRef.current += 1
    setPendingSelection(undefined)
    setPendingNote('')
    setPendingColor(undefined)
    setPendingLineStyle(DEFAULT_READING_HIGHLIGHT_STYLE)
    setReadingAssetError(undefined)
  }

  function replacePendingSelection(contentWindow: Window) {
    resetPendingSelection({
      preserveDraft: true,
      clearNativeSelection:
        pendingSelectionWindowRef.current !== contentWindow,
    })
  }

  function clearPendingNoteSaveTimer() {
    clearTimeout(pendingNoteSaveTimerRef.current)
    pendingNoteSaveTimerRef.current = undefined
  }

  function schedulePendingNoteSave() {
    clearPendingNoteSaveTimer()
    pendingNoteSaveTimerRef.current = setTimeout(() => {
      pendingNoteSaveTimerRef.current = undefined
      const selection = pendingSelectionRef.current
      const existing = pendingExistingHighlightRef.current
      if (
        !selection ||
        !pendingNoteDirtyRef.current ||
        (!pendingNoteRef.current.trim() && !existing)
      ) {
        return
      }
      void handleSaveSelection(
        pendingColorRef.current ?? existing?.color ?? NOTE_HIGHLIGHT_COLOR,
      )
    }, 500)
  }

  async function handleDeletePendingHighlight() {
    const existing = pendingExistingHighlightRef.current
    if (!existing || isSavingSelectionRef.current) return
    clearPendingNoteSaveTimer()
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    try {
      if (await handleDeleteAsset(existing)) finishPendingSelection()
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
    }
  }

  function dismissPendingSelection() {
    const existing = pendingExistingHighlightRef.current
    const shouldSaveNote =
      pendingNoteDirtyRef.current &&
      (Boolean(pendingNoteRef.current.trim()) || Boolean(existing))
    const shouldSaveLineStyle =
      pendingLineStyleDirtyRef.current && Boolean(existing)

    if (shouldSaveNote || shouldSaveLineStyle) {
      void handleSaveSelection(
        pendingColorRef.current ?? existing?.color ?? NOTE_HIGHLIGHT_COLOR,
        true,
      )
      return
    }
    resetPendingSelection({
      preserveDraft: true,
      clearNativeSelection: true,
    })
  }

  function cancelPendingSelection() {
    resetPendingSelection({
      preserveDraft: false,
      clearNativeSelection: true,
    })
  }

  function finishPendingSelection(version?: number) {
    if (
      version !== undefined &&
      version !== pendingSelectionVersionRef.current
    ) {
      return
    }
    resetPendingSelection({
      preserveDraft: false,
      clearNativeSelection: true,
    })
  }

  async function handleSaveSelection(
    color: ReadingHighlightColor,
    closeAfterSave = false,
  ) {
    const selection = pendingSelectionRef.current
    if (!selection) return
    if (isSavingSelectionRef.current) {
      if (closeAfterSave) closePendingSelectionAfterSaveRef.current = true
      return
    }
    clearPendingNoteSaveTimer()
    const note = pendingNoteRef.current
    const lineStyle = pendingLineStyleRef.current
    const selectionVersion = pendingSelectionVersionRef.current
    const previousColor = pendingColorRef.current
    pendingColorRef.current = color
    setPendingColor(color)
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    setReadingAssetError(undefined)

    try {
      const existing =
        pendingExistingHighlightRef.current ??
        readingAssets.find(
          (asset): asset is ReadingHighlight =>
            asset.kind === 'highlight' && asset.cfi === selection.cfi,
        )
      if (existing) {
        const updated = await updateReadingHighlight(existing.id, {
          color,
          lineStyle,
          note,
          text: selection.text,
        })
        if (!updated) throw new Error('这条划线已经不存在。')
        pendingExistingHighlightRef.current = updated
        if (renditionRef.current) {
          renditionRef.current.annotations.remove(existing.cfi, 'highlight')
          renderReadingHighlight(
            renditionRef.current,
            updated,
            handleReadingHighlightOpen,
          )
        }
        setReadingAssets((current) =>
          current.map((asset) => (asset.id === updated.id ? updated : asset)),
        )
      } else {
        const now = Date.now()
        const highlight: ReadingHighlight = {
          id: crypto.randomUUID(),
          bookId: bookRecord.id,
          kind: 'highlight',
          cfi: selection.cfi,
          href: selection.href,
          chapterLabel: selection.chapterLabel,
          text: selection.text,
          color,
          lineStyle,
          note: note.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        }
        await saveReadingAsset(highlight)
        pendingExistingHighlightRef.current = highlight
        if (renditionRef.current) {
          renderReadingHighlight(
            renditionRef.current,
            highlight,
            handleReadingHighlightOpen,
          )
        }
        setReadingAssets((current) => [highlight, ...current])
      }

      selectionDraftsRef.current.delete(selection.cfi)
      try {
        pendingSelectionWindowRef.current?.getSelection()?.removeAllRanges()
      } catch {
        // The content document may have unloaded while the asset was saved.
      }
      pendingSelectionWindowRef.current = undefined
      if (pendingNoteRef.current === note) pendingNoteDirtyRef.current = false
      if (pendingLineStyleRef.current === lineStyle) {
        pendingLineStyleDirtyRef.current = false
      }

      const shouldClose =
        closeAfterSave || closePendingSelectionAfterSaveRef.current
      closePendingSelectionAfterSaveRef.current = false
      const hasNewerChanges =
        pendingNoteDirtyRef.current || pendingLineStyleDirtyRef.current
      if (shouldClose && hasNewerChanges) {
        closePendingSelectionAfterSaveRef.current = true
      } else if (shouldClose) {
        finishPendingSelection(selectionVersion)
      }
    } catch (saveError) {
      pendingColorRef.current = previousColor
      setPendingColor(previousColor)
      closePendingSelectionAfterSaveRef.current = false
      if (selectionVersion === pendingSelectionVersionRef.current) {
        setReadingAssetError(
          saveError instanceof Error ? saveError.message : '保存划线失败。',
        )
      }
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
      if (
        closePendingSelectionAfterSaveRef.current &&
        selectionVersion === pendingSelectionVersionRef.current
      ) {
        closePendingSelectionAfterSaveRef.current = false
        void handleSaveSelection(
          pendingColorRef.current ?? NOTE_HIGHLIGHT_COLOR,
          true,
        )
      }
    }
  }

  async function handlePendingLineStyleChange(
    lineStyle: ReadingHighlightStyle,
  ) {
    if (
      isSavingSelectionRef.current ||
      pendingLineStyleRef.current === lineStyle
    ) {
      return
    }

    const previousLineStyle = pendingLineStyleRef.current
    const existing = pendingExistingHighlightRef.current
    pendingLineStyleRef.current = lineStyle
    pendingLineStyleDirtyRef.current = true
    setPendingLineStyle(lineStyle)
    if (!existing) return

    pendingLineStyleDirtyRef.current = false
    isSavingSelectionRef.current = true
    setIsSavingSelection(true)
    setReadingAssetError(undefined)

    try {
      const updated = await updateReadingHighlight(existing.id, { lineStyle })
      if (!updated) throw new Error('这条划线已经不存在。')
      pendingExistingHighlightRef.current = updated
      setReadingAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      if (renditionRef.current) {
        renditionRef.current.annotations.remove(existing.cfi, 'highlight')
        renderReadingHighlight(
          renditionRef.current,
          updated,
          handleReadingHighlightOpen,
        )
      }
    } catch (updateError) {
      pendingLineStyleRef.current = previousLineStyle
      setPendingLineStyle(previousLineStyle)
      setReadingAssetError(
        updateError instanceof Error
          ? updateError.message
          : '更新划线样式失败。',
      )
    } finally {
      isSavingSelectionRef.current = false
      setIsSavingSelection(false)
      if (pendingNoteDirtyRef.current) schedulePendingNoteSave()
    }
  }

  async function handleDeleteAsset(asset: ReadingAsset): Promise<boolean> {
    const removed = await readingAssetController.remove(asset)
    if (removed && asset.kind === 'highlight') {
      renditionRef.current?.annotations.remove(asset.cfi, 'highlight')
    }
    return removed
  }

  async function handleUpdateHighlight(
    highlight: ReadingHighlight,
    patch: Partial<Pick<ReadingHighlight, 'color' | 'lineStyle' | 'note'>>,
  ): Promise<boolean> {
    const updated = await readingAssetController.update(highlight, patch)
    if (!updated) return false
    if (
      renditionRef.current &&
      (patch.color !== undefined ||
        patch.lineStyle !== undefined ||
        patch.note !== undefined)
    ) {
      renditionRef.current.annotations.remove(highlight.cfi, 'highlight')
      renderReadingHighlight(
        renditionRef.current,
        updated,
        handleReadingHighlightOpen,
      )
    }
    return true
  }

  function handleSelectAsset(asset: ReadingAsset) {
    dismissPendingSelection()
    setActiveAssetId(asset.id)
    void renditionRef.current?.display(asset.cfi)
    if (window.innerWidth < 780) setTocOpen(false)
  }

  const currentBookmark = readingAssets.find(
    (asset) =>
      asset.kind === 'bookmark' && asset.cfi === currentLocationRef.current,
  )

  async function handleToggleBookmark() {
    const cfi = currentLocationRef.current
    if (!cfi || isSavingBookmark) return
    await readingAssetController.toggleBookmark(currentBookmark, () => {
        const now = Date.now()
        return {
          id: crypto.randomUUID(),
          bookId: bookRecord.id,
          kind: 'bookmark',
          cfi,
          href: currentHref,
          chapterLabel,
          createdAt: now,
          updatedAt: now,
        } satisfies ReadingAsset
      })
  }

  function handleNavigationToggle(panel: NavigationPanel) {
    dismissPendingSelection()
    setSettingsOpen(false)
    if (tocOpen && navigationPanel === panel) {
      setTocOpen(false)
      return
    }
    setNavigationPanel(panel)
    setTocOpen(true)
  }

  function displayChapter(href: string) {
    dismissPendingSelection()
    displayReaderChapter(href)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function displaySearchResult(result: BookSearchResult) {
    dismissPendingSelection()
    resetChapterBoundary()
    void renditionRef.current?.display(result.cfi)
    if (window.innerWidth < 980) setTocOpen(false)
  }

  function handleReaderFlowChange(flow: ReaderFlow) {
    dismissPendingSelection()
    resetChapterBoundary()
    setReaderFlow(flow)
  }

  const chapterPercent = Math.round(chapterProgress * 100)
  const chapterNeighbors = currentHref
    ? findChapterNeighbors(toc, currentHref)
    : {}
  const previousChapter = chapterNeighbors.previous
  const nextChapter = chapterNeighbors.next
  const shouldOfferPreviousChapter =
    readerFlow === 'chapter' && atChapterStart && Boolean(previousChapter)
  const shouldOfferNextChapter =
    readerFlow !== 'continuous' && atChapterEnd && Boolean(nextChapter)

  function handleForward() {
    dismissPendingSelection()
    if (atChapterEnd && nextChapter) {
      displayChapter(nextChapter.href)
      return
    }
    void renditionRef.current?.next()
  }

  function handleBackward() {
    dismissPendingSelection()
    void renditionRef.current?.prev()
  }

  const readerLayoutStyle = {
    '--reader-column-width': `${READER_WIDTHS[readerWidth]}px`,
  } as CSSProperties

  return (
    <main className={`reader-page theme-${theme}`} style={readerLayoutStyle}>
      <div
        className={
          tocOpen
            ? `reader-layout toc-is-open ${navigationPanel}-is-open`
            : 'reader-layout'
        }
      >
        {tocOpen ? (
          <>
            {navigationPanel === 'toc' ? (
              <TocPanel
                items={toc}
                currentHref={currentHref}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onShowAssets={() => setNavigationPanel('assets')}
                onSearch={() => setNavigationPanel('search')}
                onSelect={displayChapter}
              />
            ) : navigationPanel === 'search' ? (
              <BookSearchPanel
                bookId={bookRecord.id}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onSearch={epubSearch.search}
                onSelect={displaySearchResult}
                onShowAssets={() => setNavigationPanel('assets')}
                onShowToc={() => setNavigationPanel('toc')}
              />
            ) : (
              <ReadingAssetsPanel
                book={bookRecord}
                assets={readingAssets}
                activeAssetId={activeAssetId}
                activeAssetFocusVersion={activeAssetFocusVersion}
                errorMessage={readingAssetError}
                onBack={onBack}
                onClose={() => setTocOpen(false)}
                onDelete={handleDeleteAsset}
                onSelect={handleSelectAsset}
                onShowSearch={() => setNavigationPanel('search')}
                onShowToc={() => setNavigationPanel('toc')}
                onUpdateHighlight={handleUpdateHighlight}
              />
            )}
            <button
              className="toc-backdrop"
              type="button"
              aria-label="关闭书内导航"
              onClick={() => setTocOpen(false)}
            />
          </>
        ) : null}

        <section className="reader-main">
          <ReaderHeader
            title={bookRecord.title}
            chapterLabel={chapterLabel}
            navigationOpen={tocOpen}
            navigationPanel={navigationPanel}
            hasCurrentBookmark={Boolean(currentBookmark)}
            canBookmark={Boolean(currentLocationRef.current)}
            isSavingBookmark={isSavingBookmark}
            settingsOpen={settingsOpen}
            settingsAnchorRef={settingsAnchorRef}
            preferences={preferences}
            onOpenNavigation={() => setTocOpen(true)}
            onNavigationToggle={handleNavigationToggle}
            onBookmarkToggle={() => void handleToggleBookmark()}
            onSettingsToggle={() => setSettingsOpen((open) => !open)}
            onFlowChange={handleReaderFlowChange}
          />

          <ReaderStage
            flow={readerFlow}
            clickPagination={clickPagination}
            isOpening={isOpening}
            openingMessage={openingMessage}
            error={error}
            viewerRef={viewerRef}
            chapterProgress={chapterProgress}
            chapterScrollSize={chapterScrollSize}
            chapterViewportSize={chapterViewportSize}
            onBack={onBack}
            onPageTurn={(direction) => {
              if (direction === 'previous') handleBackward()
              else handleForward()
            }}
            onChapterScroll={scrollChapterToProgress}
            selectionEditor={
              pendingSelection ? (
                <SelectionEditor
                  selection={pendingSelection}
                  note={pendingNote}
                  color={pendingColor}
                  lineStyle={pendingLineStyle}
                  isSaving={isSavingSelection}
                  isExisting={Boolean(pendingExistingHighlightRef.current)}
                  errorMessage={readingAssetError}
                  onDelete={() => void handleDeletePendingHighlight()}
                  onDismiss={dismissPendingSelection}
                  onNoteChange={(note) => {
                    pendingNoteRef.current = note
                    pendingNoteDirtyRef.current = true
                    setPendingNote(note)
                    schedulePendingNoteSave()
                  }}
                  onColorChange={(color) => void handleSaveSelection(color)}
                  onLineStyleChange={(lineStyle) =>
                    void handlePendingLineStyleChange(lineStyle)
                  }
                />
              ) : undefined
            }
          />

          <ReaderFooter
            flow={readerFlow}
            chapterPercent={chapterPercent}
            atChapterEnd={atChapterEnd}
            previousChapter={previousChapter}
            nextChapter={nextChapter}
            offerPreviousChapter={shouldOfferPreviousChapter}
            offerNextChapter={shouldOfferNextChapter}
            onBackward={handleBackward}
            onForward={handleForward}
            onDisplayChapter={displayChapter}
          />
        </section>
      </div>
    </main>
  )
}
