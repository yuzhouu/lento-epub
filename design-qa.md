# Design QA — empty library editorial redesign

## Comparison target

- Source visual truth: `/Users/yuzhou/.codex/generated_images/01a06637-0f7b-7310-9c37-42b7bdf4dfc0/exec-d4057da5-24ba-4add-91b3-f207045e22b3.png`
- Final implementation screenshot: `/tmp/lento-empty-editorial-desktop-no-crop.png`
- Responsive screenshots: `/tmp/lento-empty-editorial-1280x720-no-crop.png` and `/tmp/lento-empty-editorial-mobile-no-crop.png`
- Route/state: library root, Chinese locale, zero imported books, storage estimate available
- Viewport: 1487 × 1058 CSS px, device pixel ratio 1
- Pixels: source 1487 × 1058; implementation 1487 × 1058; no density normalization required
- Responsive checks: 1280 × 720 and 390 × 844 CSS px, device pixel ratio 1; screenshots match those CSS sizes

## Full-view comparison evidence

The source and implementation were opened together at the same 1487 × 1058 size. The implementation preserves the source's editorial hierarchy: quiet full-height paper field, ruled header, oversized left-aligned library title, small book count, green dash, compact empty-state copy and action, pale right-hand book artwork, and a nearly invisible colophon footer. Header and footer remain the real product components rather than mock-only replacements. The source's short rule below the primary action is intentionally omitted following the user's explicit refinement.

## Required fidelity surfaces

- Fonts and typography: the existing CJK serif stack, weights, tracking, and line heights reproduce the source hierarchy. Display, body, utility, and footer text remain clearly separated. No wrapping or truncation was observed at either viewport.
- Spacing and layout rhythm: desktop uses the same asymmetric two-column composition and bottom-anchored colophon. The 1487 × 1058 page has no vertical or horizontal overflow. At 1280 × 720 the artwork scales to the available grid cell instead of being clipped. The 390 × 844 layout collapses deliberately, keeps the primary action above the fold, shows the complete open-book base, and has no overflow.
- Colors and visual tokens: existing paper, ink, muted text, rule, and green tokens map closely to the source. The generated artwork opacity was tuned to sit behind the content rather than compete with it.
- Image quality and asset fidelity: a generated textured book/character/seal asset is used instead of CSS or inline drawing. It has real transparency, no visible rectangular matte or checkerboard, and was stored as lossless WebP to retain the fine engraving while reducing bundle weight.
- Copy and content: visible Chinese empty-state, storage, navigation, and action copy match the working product and the selected source. Existing localization remains functional.

Focused region crops were not needed: at the matched 1487 × 1058 full-view size, the header typography, main copy, button, artwork texture/seal, and footer text are all individually legible and large enough to judge.

## Comparison history

1. Initial comparison found a P2 artwork treatment mismatch: the implementation artwork was darker than the source, and an earlier mobile alpha treatment left a faint rectangular edge.
2. Fixes applied: strengthened the white-to-alpha key, reduced desktop artwork opacity to `0.72`, balanced mobile wrapper opacity, and replaced the 1.6 MB PNG with a 456 KB lossless WebP.
3. Post-fix evidence: `/tmp/lento-empty-editorial-desktop-final.png` was compared together with the source at equal pixels; `/tmp/lento-empty-editorial-mobile-webp.png` confirms the matte edge is gone and the mobile composition remains within 390 × 844.
4. User-directed refinement: removed the short rule below the primary action. `/tmp/lento-empty-editorial-desktop-no-line.png` and `/tmp/lento-empty-editorial-mobile-no-line.png` confirm the rule is absent with no overflow or console errors.
5. A later P2 responsive finding showed the artwork's open-book base could be clipped in shorter windows. The image was changed to contain inside the actual artwork grid cell, and the mobile negative bottom offset was removed. `/tmp/lento-empty-editorial-1280x720-no-crop.png`, `/tmp/lento-empty-editorial-mobile-no-crop.png`, and the equal-size final comparison confirm the full base and seal remain visible.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3 acceptable drift: the production artwork sits slightly lower and the live product's existing font metrics differ subtly from the generated concept. These preserve the intended hierarchy and do not change the above-the-fold content or density.

## Interaction and regression evidence

- Switched the interface to English and back to Chinese; title, empty-state text, and add action updated correctly.
- Opened the About route from the footer and navigated back to the empty library successfully.
- Opened the same build on the existing 2-book local origin; the populated library layout, toolbar, storage summary, and list remained intact.
- Clean final browser tab reported no console warnings or errors.
- Automated verification: 26 tests passed, TypeScript passed, web and extension production builds passed.

## Implementation checklist

- [x] Match selected desktop composition and copy
- [x] Preserve real header/footer/import/localization behavior
- [x] Add generated transparent editorial artwork
- [x] Verify 1487 × 1058 and 390 × 844 layouts
- [x] Verify empty and populated library states
- [x] Verify interactions, console, tests, typecheck, and production builds

final result: passed
