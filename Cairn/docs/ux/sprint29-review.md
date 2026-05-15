# UX Review — Sprint 29

**Sprint Goal**: Token completion + form polish + routes UX
**Reviewer**: UX subagent (claude-opus-4-6)
**Confidence**: HIGH

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Low | Sign In auto-focus: immediate keyboard appearance is slightly aggressive for first-time users but follows platform convention. Net positive UX. | signin-autofocus-01.png |
| Low | Routes Download button: outlined pill is discoverable, but unicode ⬇ character may render inconsistently vs. a proper icon. Minor robustness concern. | routes-download-02.png |
| Low | FlagPlantSheet char counter only turns red at exactly 30/30, giving no warning as user approaches limit. A yellow/orange state at 25/30 would reduce surprise. | flagsheet-error-05.png |

No Blockers. No Criticals.

## What Works Well

- Green focus border (#5d7c46) on Sign In email immediately on mount — reduces friction for returning users
- Download buttons are clearly actionable, primary color border communicates interactivity
- Char counter "0/30" visible immediately on focus — sets expectations before typing
- Error state (red border + red counter at 30/30) is distinct from focus state (green border)
- Settings switches: green fill = on, light grey = off — unambiguous, no learning curve

## Untested Paths

- Sign In: focus ring behavior when returning from password back to email
- Routes Download: behavior on slow network (no loading indicator visible)
- FlagPlantSheet: paste behavior when pasting text > 30 chars
- Routes empty state (mock data has routes — empty state not exercised)

## Knowledge Updates

- Sprint 29 established a consistent three-state interaction language: green = focused/active, grey = unfocused, red = error. Learnable and coherent across the app.
- Colors.danger (#c53d2e) is the first inline validation pattern — future input validation Stories should follow this.
- Navigation regression: 2 Wake Lock errors are pre-existing (Sprint 28), no Sprint 29 regressions.
- Settings toggle pattern: green fill for on, grey for off — standard platform convention.
