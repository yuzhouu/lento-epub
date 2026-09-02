import ePub from 'epubjs'

export type EpubBook = ReturnType<typeof ePub>
export type EpubRendition = ReturnType<EpubBook['renderTo']>
export type EpubSection = ReturnType<EpubBook['spine']['get']>
