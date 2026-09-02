import { useDeferredValue, useState } from 'react'
import { Search } from 'lucide-react'
import {
  getReadableLocalFontName,
  getReaderFontFamily,
} from '../../../lib/reader-font'

const LOCAL_FONT_PAGE_SIZE = 60
export const LOCAL_FONT_PREVIEW_ZH = '春风翻过书页'
export const LOCAL_FONT_PREVIEW_EN = 'The quick brown fox'

interface LocalFontPickerProps {
  families: string[]
  selectedFont: string
  onSelect: (family: string) => void
}

export function LocalFontPicker({
  families,
  selectedFont,
  onSelect,
}: LocalFontPickerProps) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(LOCAL_FONT_PAGE_SIZE)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const matchingFonts = deferredQuery
    ? families.filter((family) =>
        family.toLocaleLowerCase().includes(deferredQuery),
      )
    : families
  const visibleFonts = matchingFonts.slice(0, visibleCount)

  return (
    <div className="local-font-picker">
      <label className="local-font-search">
        <Search aria-hidden="true" size={14} strokeWidth={1.6} />
        <span className="visually-hidden">搜索系统字体</span>
        <input
          type="search"
          value={query}
          placeholder="搜索系统字体"
          onChange={(event) => {
            setQuery(event.target.value)
            setVisibleCount(LOCAL_FONT_PAGE_SIZE)
          }}
        />
      </label>
      <div className="local-font-list" role="listbox" aria-label="系统字体样张">
        {visibleFonts.length > 0 ? (
          visibleFonts.map((family) => {
            const readableName = getReadableLocalFontName(family)
            return (
              <button
                className={
                  selectedFont === family
                    ? 'local-font-choice is-selected'
                    : 'local-font-choice'
                }
                key={family}
                type="button"
                role="option"
                aria-selected={selectedFont === family}
                onClick={() => onSelect(family)}
              >
                <span
                  className="local-font-preview"
                  style={{
                    fontFamily: getReaderFontFamily({
                      source: 'local',
                      family,
                    }),
                  }}
                >
                  <span lang="zh-CN">{LOCAL_FONT_PREVIEW_ZH}</span>
                  {' · '}
                  <span lang="en">{LOCAL_FONT_PREVIEW_EN}</span>
                </span>
                <span className="local-font-name">{readableName ?? family}</span>
                {readableName ? (
                  <span className="local-font-technical-name">{family}</span>
                ) : null}
              </button>
            )
          })
        ) : (
          <span className="local-font-empty">没有匹配的字体</span>
        )}
      </div>
      <div className="local-font-list-footer">
        <span>
          已显示 {visibleFonts.length} / {matchingFonts.length}
        </span>
        {visibleFonts.length < matchingFonts.length ? (
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) => count + LOCAL_FONT_PAGE_SIZE)
            }
          >
            继续显示
          </button>
        ) : null}
      </div>
    </div>
  )
}
