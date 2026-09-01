# 卷舍 · Lento — interface system

The library follows `design/library-concept.png`. The reading page follows
`design/reader-llm-concept.png`; `design/reader-concept.png` is the previous
reading-page direction.

- Background: warm paper `#f5f2eb`; ink `#1e2925`; muted text `#69726d`.
- Accent: oxidized green `#315d4b`, used only for primary actions, current state, and progress.
- Content type: Songti-style serif stack; controls and metadata use the system sans-serif stack.
- Library containers: open page, dividers, and list rhythm. No dashboard cards or large floating panels.
- Reader shell: a 272 px navigation rail, compact top toolbar, centered 760 px
  EPUB stream, and a slim progress/footer region. It borrows the spatial rhythm
  of contemporary LLM apps but intentionally has no composer or chat controls.
- Reader chrome: neutral system sans-serif, 13–14 px controls, 9–10 px radii,
  subtle gray selection/hover states, and 1.7 px Lucide outline icons.
- Motion: 160–170 ms state transitions, removed when `prefers-reduced-motion` is enabled.
- Icons: Lucide outline icons at 1.4–1.7 px strokes.
- Reading column: maximum 760 px in both scrolling and paginated EPUB modes.
