import { DEFAULT_READING_HIGHLIGHT_STYLE } from '../../../lib/reading-highlight-styles'
import type {
  ReadingHighlight,
  ReadingHighlightColor,
} from '../../../types/book'
import type { EpubRendition } from './epub-types'

const HIGHLIGHT_STROKES: Record<ReadingHighlightColor, string> = {
  yellow: '#d3a600',
  orange: '#e97c18',
  lime: '#78a91f',
  green: '#229866',
  cyan: '#168fa9',
  blue: '#4f7fd1',
  rose: '#d95470',
  violet: '#8461d1',
}

interface EpubSvgMark {
  element?: SVGGElement
  render?: () => void
  lentoDecorationAttached?: boolean
}

interface EpubAnnotationHandle {
  mark?: EpubSvgMark
  on(event: 'attach', listener: (mark: EpubSvgMark) => void): void
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  document: Document,
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', name)
}

function createWavyUnderlinePath(x: number, y: number, width: number): string {
  const end = x + width
  const halfWaveWidth = 4.6
  const amplitude = 1.5
  let cursor = x
  let direction = -1
  let path = `M ${x} ${y}`

  while (cursor < end) {
    const next = Math.min(cursor + halfWaveWidth, end)
    const span = next - cursor
    const waveY = y + direction * amplitude
    path += ` C ${cursor + span * 0.28} ${waveY} ${cursor + span * 0.72} ${waveY} ${next} ${y}`
    cursor = next
    direction *= -1
  }

  return path
}

function decorateReadingMark(mark: EpubSvgMark, highlight: ReadingHighlight) {
  const group = mark.element
  if (!group) return

  group
    .querySelectorAll('.lento-annotation-decoration')
    .forEach((element) => element.remove())

  const stroke = HIGHLIGHT_STROKES[highlight.color]
  const lineStyle =
    highlight.lineStyle ?? DEFAULT_READING_HIGHLIGHT_STYLE
  const geometryRects = Array.from(group.children).filter(
    (element): element is SVGRectElement =>
      element.tagName.toLocaleLowerCase() === 'rect',
  )

  geometryRects.forEach((rect) => {
    const x = Number(rect.getAttribute('x'))
    const y = Number(rect.getAttribute('y'))
    const width = Number(rect.getAttribute('width'))
    const height = Number(rect.getAttribute('height'))
    if (![x, y, width, height].every(Number.isFinite) || width <= 0) return

    rect.setAttribute('fill', 'transparent')
    rect.setAttribute('stroke', 'none')

    if (lineStyle === 'double') {
      for (const bottomOffset of [3.25, 1.05]) {
        const line = createSvgElement(group.ownerDocument, 'line')
        line.classList.add(
          'lento-annotation-decoration',
          'lento-annotation-double',
        )
        line.setAttribute('x1', String(x))
        line.setAttribute('x2', String(x + width))
        line.setAttribute('y1', String(y + height - bottomOffset))
        line.setAttribute('y2', String(y + height - bottomOffset))
        line.setAttribute('stroke', stroke)
        line.setAttribute('stroke-width', '1.25')
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('vector-effect', 'non-scaling-stroke')
        group.append(line)
      }
      return
    }

    if (lineStyle === 'single') {
      const line = createSvgElement(group.ownerDocument, 'line')
      line.classList.add(
        'lento-annotation-decoration',
        'lento-annotation-single',
      )
      line.setAttribute('x1', String(x))
      line.setAttribute('x2', String(x + width))
      line.setAttribute('y1', String(y + height - 1.2))
      line.setAttribute('y2', String(y + height - 1.2))
      line.setAttribute('stroke', stroke)
      line.setAttribute('stroke-width', '1.7')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('vector-effect', 'non-scaling-stroke')
      group.append(line)
      return
    }

    const path = createSvgElement(group.ownerDocument, 'path')
    path.classList.add(
      'lento-annotation-decoration',
      'lento-annotation-wave',
    )
    path.setAttribute(
      'd',
      createWavyUnderlinePath(x, y + height - 1.5, width),
    )
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', '1.7')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    group.append(path)
  })
}

function attachReadingMarkDecoration(
  mark: EpubSvgMark,
  highlight: ReadingHighlight,
) {
  if (!mark.render || mark.lentoDecorationAttached) {
    decorateReadingMark(mark, highlight)
    return
  }

  const render = mark.render.bind(mark)
  mark.render = () => {
    render()
    decorateReadingMark(mark, highlight)
  }
  mark.lentoDecorationAttached = true
  decorateReadingMark(mark, highlight)
}

export function renderReadingHighlight(
  rendition: EpubRendition,
  highlight: ReadingHighlight,
  onOpen: (highlight: ReadingHighlight) => void,
) {
  const annotation = rendition.annotations.highlight(
    highlight.cfi,
    { assetId: highlight.id },
    () => onOpen(highlight),
    'lento-reading-highlight',
    {
      fill: 'transparent',
      'fill-opacity': '0',
      'mix-blend-mode': 'normal',
    },
  ) as unknown as EpubAnnotationHandle | undefined
  if (!annotation) return
  const decorate = (mark: EpubSvgMark) =>
    attachReadingMarkDecoration(mark, highlight)
  annotation.on('attach', decorate)
  if (annotation.mark) decorate(annotation.mark)
}

export function attachReadingHighlightHover(contentDocument: Document) {
  const frameElement = contentDocument.defaultView?.frameElement
  if (!(frameElement instanceof HTMLIFrameElement)) return () => undefined
  const iframe = frameElement

  let hoverFrame: number | undefined
  let pointerX = 0
  let pointerY = 0
  let hoveredMark: SVGGElement | undefined

  function clearHoveredMark() {
    hoveredMark?.classList.remove('is-hovered')
    hoveredMark = undefined
  }

  function updateHoveredMark() {
    hoverFrame = undefined
    const frameBounds = iframe.getBoundingClientRect()
    const pointX = frameBounds.left + pointerX
    const pointY = frameBounds.top + pointerY
    const nextHoveredMark = Array.from(
      iframe.parentElement?.querySelectorAll<SVGGElement>(
        'g.lento-reading-highlight',
      ) ?? [],
    ).find((group) =>
      Array.from(group.children).some((element) => {
        if (element.tagName.toLocaleLowerCase() !== 'rect') return false
        const bounds = element.getBoundingClientRect()
        return (
          pointX >= bounds.left &&
          pointX <= bounds.right &&
          pointY >= bounds.top &&
          pointY <= bounds.bottom
        )
      }),
    )
    if (nextHoveredMark === hoveredMark) return
    clearHoveredMark()
    nextHoveredMark?.classList.add('is-hovered')
    hoveredMark = nextHoveredMark
  }

  function handlePointerMove(event: PointerEvent) {
    pointerX = event.clientX
    pointerY = event.clientY
    if (hoverFrame !== undefined) return
    hoverFrame = requestAnimationFrame(updateHoveredMark)
  }

  function handlePointerLeave() {
    cancelAnimationFrame(hoverFrame ?? 0)
    hoverFrame = undefined
    clearHoveredMark()
  }

  contentDocument.addEventListener('pointermove', handlePointerMove, {
    passive: true,
  })
  contentDocument.addEventListener('pointerleave', handlePointerLeave)
  return () => {
    contentDocument.removeEventListener('pointermove', handlePointerMove)
    contentDocument.removeEventListener('pointerleave', handlePointerLeave)
    handlePointerLeave()
  }
}
