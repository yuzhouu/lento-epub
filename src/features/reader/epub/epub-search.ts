import type { EpubSection } from './epub-types'

export interface EpubSearchMatch {
  cfi: string
  excerpt: string
}

export function findSectionMatches(
  section: EpubSection,
  query: string,
): EpubSearchMatch[] {
  const root =
    section.document.querySelector('body') ?? section.document.documentElement
  const walker = section.document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const normalizedQuery = query.toLocaleLowerCase()
  const matches: EpubSearchMatch[] = []
  let node = walker.nextNode()

  while (node) {
    const parent = node.parentElement
    const text = node.textContent ?? ''
    if (
      text.trim() &&
      !parent?.closest('script, style, noscript, svg, [aria-hidden="true"]')
    ) {
      const normalizedText = text.toLocaleLowerCase()
      let matchIndex = normalizedText.indexOf(normalizedQuery)
      while (matchIndex >= 0) {
        const range = section.document.createRange()
        range.setStart(node, matchIndex)
        range.setEnd(node, matchIndex + query.length)
        const excerptStart = Math.max(0, matchIndex - 70)
        const excerptEnd = Math.min(
          text.length,
          matchIndex + query.length + 70,
        )
        matches.push({
          cfi: section.cfiFromRange(range),
          excerpt: `${excerptStart > 0 ? '…' : ''}${text.slice(
            excerptStart,
            excerptEnd,
          )}${excerptEnd < text.length ? '…' : ''}`,
        })
        matchIndex = normalizedText.indexOf(
          normalizedQuery,
          matchIndex + query.length,
        )
      }
    }
    node = walker.nextNode()
  }

  return matches
}
