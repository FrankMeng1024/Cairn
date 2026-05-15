# UX Review — Sprint 26

**Date**: 2026-05-15
**Sprint Goal**: Flag planting excellence + SettingsScreen premium uplift
**Confidence**: HIGH

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Medium | New Run button uses RotateCcw (circular arrow) icon — conventionally "refresh/retry", not "start new". Label "New Run" compensates but creates momentary cognitive mismatch. | run-complete-new-run-btn-12.png |
| Low | HikingScreen "Back" button is top-right — platform convention places back actions top-left. Mitigated by clear text label. | hiking-map-05.png |
| Low | MapHistory shows "No GPS \| km" — the pipe separator followed by bare unit "km" adds visual noise. Consider hiding distance chip entirely when GPS unavailable. | map-history-no-gps-13.png |
| Low | FlagPlantSheet 30-char note limit is restrictive for describing trail hazards. Design decision, not a bug. | flag-note-typed-08.png |

## What Works Well

- **FlagPlantSheet**: Major improvement over dark AR overlay. All 4 type cards visible at once, progressive disclosure (disabled Save → green Save), CircleCheck selection indicator — excellent interaction pattern.
- **Settings state communication**: "Tap Save to apply" hint pill with ArrowUp icon is excellent affordance. 2px green border + primaryBg fill is clear active-state signal. Unsaved state resets correctly on navigation-away.
- **Toast feedback**: "Flag saved" toast + FAB badge increment = tight feedback loop.
- **No GPS label**: Definitively more informative than "--". User immediately understands why distance data is missing.
- **Navigation regression**: Flag count persists, settings state resets correctly. No SPA routing errors.

## Untested Paths

- FlagPlantSheet backdrop tap dismiss behavior
- Settings individual toggle rows (sharing, display, voice)
- Create Account form validation error states
- Dark mode appearance
- HowItWorks first-time-user state (sessions=0)

## Knowledge Updates (appended to knowledge.md)

1. FlagPlantSheet bottom-sheet pattern is significantly more intuitive than AR overlay. 4-card layout immediately scannable. Disabled→active Save button = strong progressive disclosure.
2. Settings gradient badges + h3 mode titles read as premium. "Tap Save to apply" hint pill prevents confusion about auto-save vs explicit-save.
3. Toast + FAB badge feedback loop = tight confirmation pattern.
4. Create Account upfront Explorer mode disclosure reduces first-run confusion.
5. "No GPS" label is definitively more informative than "--".
6. Navigation regression clean. No routing errors.
