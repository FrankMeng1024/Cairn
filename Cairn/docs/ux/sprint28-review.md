# UX Review — Sprint 28

**Confidence**: HIGH
**Sprint Goal**: Eliminate hardcoded values, improve input/selection feedback, standardize overlays
**Reviewer**: UX subagent (claude-opus-4-6)

## Friction Items

| Severity | Description | Screenshot |
|---|---|---|
| Low | Auth form: before any field is focused, both inputs appear identical with no visual hierarchy indicating where to start. Auto-focus on email on screen entry would reduce the "where do I begin?" moment. Once tapped, green focus state is excellent and immediate. | auth-signin-default.png |
| Low | Running route selection: Free Run uses green accent, named routes use blue when selected. Color distinction is logical (free vs structured) but a first-time user may briefly wonder why blue means something different from green. Checkmark badge + background tint make selection state obvious regardless — minor cognitive question, not actual confusion. | running-named-route-selected.png |

## Sprint Goal Outcomes

1. **Auth input focus** — PASS. Green border + icon tint is strong and unambiguous. Active field is immediately clear.
2. **Settings section headers** — PASS. Legible at 11px uppercase. Visual hierarchy (section header → card content) is clear. Previously reported as too small at 9px, now resolved.
3. **Running route selection** — PASS. Triple-signal system (colored left border + background tint + checkmark badge) leaves zero doubt about which route is selected. Switching gives instant, satisfying feedback.
4. **Overlay consistency** — PASS. MapHistory tab bar and stat bar use visually unified white semi-transparent treatment. No jarring differences between floating elements.

## Untested Paths

- Password field focused state (only email focus verified)
- Auth error states (invalid email, wrong password feedback)
- Settings toggle animation on interaction
- MapHistory stat bar behavior on scroll

## Evidence
- `docs/ux/sprint28-evidence/auth-default.png`
- `docs/ux/sprint28-evidence/auth-signin-default.png`
- `docs/ux/sprint28-evidence/auth-email-focused.png`
- `docs/ux/sprint28-evidence/settings-full.png`
- `docs/ux/sprint28-evidence/running-route-selection.png`
- `docs/ux/sprint28-evidence/running-named-route-selected.png`
- `docs/ux/sprint28-evidence/maphistory-session-list.png`
