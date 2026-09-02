import { useRef, useState, type DragEvent } from 'react'

function containsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export function useEpubDrop(importFiles: (files: File[]) => Promise<void>) {
  const dragDepthRef = useRef(0)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)

  function onDragEnter(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }

  function onDragLeave() {
    if (dragDepthRef.current === 0) return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingFiles(false)
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    if (!containsFiles(event) && event.dataTransfer.files.length === 0) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)
    void importFiles(Array.from(event.dataTransfer.files))
  }

  return {
    isDraggingFiles,
    dropProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
  }
}
