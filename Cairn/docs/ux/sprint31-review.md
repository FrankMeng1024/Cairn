# UX Review — Sprint 31

**Sprint Goal**: Bring MapScreen to premium quality
**Date**: 2026-05-16
**Verdict**: PASS
**Confidence**: HIGH

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Medium | Char counter shows 30/30 in red when limit reached. Input truncates but no inline explanation. A first-time user may not understand why text was cut off. Red counter is good feedback but proactive blocking or brief label would reduce confusion. | step2c-note-with-counter.png |
| Low | Download Map CTA + "Download an offline pack to get started" subtitle creates mild ambiguity — map already shows markers and trail, so user may wonder if it's functional without downloading. | step1-first-impression.png |
| Low | FAB badge "3" has no contextual label on first encounter. Meaning (3 nearby markers) only revealed on tap. Acceptable for icon-based UI but opaque initially. | step1-first-impression.png |

## Untested Paths
- Running Mode selection and UI effect
- Download Map button flow
- Permission pills (Friends/Public) visual feedback
- Helpful pill toggle on MarkerDetailSheet
- Stop button confirmation behavior
- Landscape orientation / tablet viewport

## What Works Well
- All features reachable within 1-2 taps from main screen
- State changes immediate and visually obvious (green border + CircleCheck, tracking bar appears cleanly)
- Navigation round-trip (Back → Home → Map) preserves state perfectly, zero console errors throughout
- Visual language cohesive: gradient badges, card patterns, permission pills consistent across all sheets
- Activity modal self-explanatory — Hiking/Running modes clearly differentiated
- Tracking bar left-border accent cleanly separates from map content, no z-index overlap

## Summary
MapScreen experience is cohesive and well-structured. Every major feature reachable within 1-2 taps. State changes immediate and obvious. Navigation round-trip preserves state perfectly with zero errors. The visual language (gradient badges, consistent card patterns) is coherent across all sheets. Minor friction points (char counter truncation UX, Download CTA ambiguity, FAB badge context) do not prevent task completion. This is a premium-quality mobile UX that a hiking enthusiast could pick up and use without instruction.

## Evidence
- `docs/ux/sprint31-evidence/step1-first-impression.png`
- `docs/ux/sprint31-evidence/step2a-create-sheet-open.png`
- `docs/ux/sprint31-evidence/step2b-scenic-selected.png`
- `docs/ux/sprint31-evidence/step2c-note-with-counter.png`
- `docs/ux/sprint31-evidence/step3-marker-detail-sheet.png`
- `docs/ux/sprint31-evidence/step4-nav-return.png`
- `docs/ux/sprint31-evidence/step5-tracking-active.png`
- `docs/ux/sprint31-evidence/step6-activity-modal.png`
