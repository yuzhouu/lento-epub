import type { ReadingHighlightStyle } from '../../types/book'

interface ReadingHighlightStyleIconProps {
  style: ReadingHighlightStyle
}

export function ReadingHighlightStyleIcon({
  style,
}: ReadingHighlightStyleIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 22 14"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    >
      {style === 'wave' ? (
        <path d="M1 8 Q3 3 5 8 T9 8 T13 8 T17 8 T21 8" />
      ) : style === 'double' ? (
        <>
          <path d="M2 5.25 H20" />
          <path d="M2 9.75 H20" />
        </>
      ) : (
        <path d="M2 8 H20" />
      )}
    </svg>
  )
}
