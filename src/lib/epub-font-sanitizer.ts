interface EpubStyleResources {
  cssUrls: string[]
  urls: string[]
  replacementUrls: Array<string | null | undefined>
}

interface EpubStyleBook {
  opened: Promise<unknown>
  resources: EpubStyleResources
  spine: {
    hooks: {
      content: {
        register(handler: (document: Document) => void): void
      }
    }
  }
}

const FONT_FACE_RULE_PATTERN =
  /@font-face\s*\{(?:[^{}"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\}/gi
const FONT_SOURCE_URL_PATTERN =
  /url\(\s*(?:(['"])(.*?)\1|([^)]*))\s*\)/gi
const DEVICE_LOCAL_FONT_PROTOCOL_PATTERN = /^(?:file|res|resource):/i

function decodeCssEscapes(value: string): string {
  return value.replace(
    /\\(?:([0-9a-f]{1,6})[ \t\r\n\f]?|([^\r\n\f]))/gi,
    (_match, hexEscape: string | undefined, escaped: string | undefined) =>
      hexEscape
        ? String.fromCodePoint(Number.parseInt(hexEscape, 16))
        : (escaped ?? ''),
  )
}

function usesDeviceLocalFont(rule: string): boolean {
  const withoutComments = rule.replace(/\/\*[\s\S]*?\*\//g, '')
  FONT_SOURCE_URL_PATTERN.lastIndex = 0

  for (
    let match = FONT_SOURCE_URL_PATTERN.exec(withoutComments);
    match;
    match = FONT_SOURCE_URL_PATTERN.exec(withoutComments)
  ) {
    const source = decodeCssEscapes(match[2] ?? match[3] ?? '').trim()
    if (DEVICE_LOCAL_FONT_PROTOCOL_PATTERN.test(source)) return true
  }

  return false
}

export function stripUnsupportedFontFaces(css: string): string {
  FONT_FACE_RULE_PATTERN.lastIndex = 0
  return css.replace(FONT_FACE_RULE_PATTERN, (rule) =>
    usesDeviceLocalFont(rule) ? '' : rule,
  )
}

function sanitizeInlineStyles(document: Document) {
  document.querySelectorAll('style').forEach((style) => {
    const css = style.textContent ?? ''
    const sanitizedCss = stripUnsupportedFontFaces(css)
    if (sanitizedCss !== css) style.textContent = sanitizedCss
  })
}

export async function sanitizeEpubFontSources(
  book: EpubStyleBook,
): Promise<() => void> {
  await book.opened
  book.spine.hooks.content.register(sanitizeInlineStyles)

  const createdStylesheetUrls: string[] = []
  const { cssUrls, urls, replacementUrls } = book.resources

  await Promise.all(
    cssUrls.map(async (cssUrl) => {
      const resourceIndex = urls.indexOf(cssUrl)
      if (resourceIndex < 0) return

      const stylesheetUrl = replacementUrls[resourceIndex]
      if (!stylesheetUrl) return

      try {
        const response = await fetch(stylesheetUrl)
        if (!response.ok) return
        const css = await response.text()
        const sanitizedCss = stripUnsupportedFontFaces(css)
        if (sanitizedCss === css) return

        const sanitizedStylesheetUrl = URL.createObjectURL(
          new Blob([sanitizedCss], { type: 'text/css' }),
        )
        replacementUrls[resourceIndex] = sanitizedStylesheetUrl
        createdStylesheetUrls.push(sanitizedStylesheetUrl)
        if (stylesheetUrl.startsWith('blob:')) {
          URL.revokeObjectURL(stylesheetUrl)
        }
      } catch {
        // A malformed stylesheet should not prevent the rest of the book opening.
      }
    }),
  )

  return () => {
    createdStylesheetUrls.forEach((url) => URL.revokeObjectURL(url))
  }
}
