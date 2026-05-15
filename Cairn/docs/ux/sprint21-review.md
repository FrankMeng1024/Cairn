# UX Review — Sprint 21

**Date**: 2026-05-15
**Reviewer**: UX subagent (first-time user perspective, claude-opus-4-6)
**Confidence**: HIGH

## Sprint Goal
AuthScreen premium redesign + cross-app micro-interaction polish — elevate first-impression quality and fix known UX gaps.

## Friction Items

| Severity | Description | Screenshot | Resolution |
|----------|-------------|------------|------------|
| Medium | Home QuickStats shows "0.0 km" for a user with 1 session — could undermine trust at first glance. Likely test-data artifact (GPS offline run). Consider "GPS unavailable" contextual note when distance is 0 but session exists. | sprint21-ux-02-home-newuser-mobile.png | Backlog |
| Low | Register form subtitle "You'll start in Explorer mode. Switch anytime in Settings" — new users don't know what Explorer mode is yet. Mildly premature. | sprint21-ux-01b-register-form.png | Backlog |
| Low | Privacy checkbox tap target may feel fiddly if only the small square is tappable (not the whole row). Implementation uses separate checkbox + link — acceptable, but worth validating on device. | sprint21-ux-01b-register-form.png | Monitor |
| Low | MapHistory expanded card shows all-zeros session (0.00 km, +0m elev, 0 flags) with no explanation. On real data this is fine; with zero values a context hint would help. | sprint21-ux-08b-history-card-expanded.png | Backlog |
| Low | Running screen lock hint shows emoji 🔒 inline with text — minor visual inconsistency with the rest of the app's line-icon system. (Note: implementation uses Icon component — may render correctly on device but appears as emoji in web preview.) | sprint21-ux-03-running-idle-mobile.png | Low priority |

## Positive Observations
- Splash screen communicates brand identity clearly — two pill buttons, no cognitive overload
- Registration form is textbook clean: labeled fields, contextual icons, correct social login hierarchy
- Route selection on Running screen is unambiguous — green left border + checkmark moves instantly on tap
- Settings Save button dirty-state pattern (grey → green when changes exist) prevents "did I save?" anxiety
- Toggle colors consistent across all settings rows: green active, grey inactive, white thumb
- Inline card expansion on MapHistory — no page navigation needed for quick stats peek
- Zero console errors across all navigation round-trips — runtime stability excellent
- Sprint 21 micro-interaction goal clearly met: immediate selection feedback, save state signal, inline expansion

## Evidence Files
- `docs/ux/sprint21-evidence/sprint21-ux-01-login-mobile.png` — splash 390px
- `docs/ux/sprint21-evidence/sprint21-ux-01b-register-form.png` — register form 390px
- `docs/ux/sprint21-evidence/sprint21-ux-02-home-newuser-mobile.png` — home 390px
- `docs/ux/sprint21-evidence/sprint21-ux-03-running-idle-mobile.png` — running idle 390px
- `docs/ux/sprint21-evidence/sprint21-ux-04-running-selected-mobile.png` — route selected 390px
- `docs/ux/sprint21-evidence/sprint21-ux-06-settings-desktop.png` — settings 1024px
- `docs/ux/sprint21-evidence/sprint21-ux-07-settings-unsaved-desktop.png` — settings unsaved 1024px
- `docs/ux/sprint21-evidence/sprint21-ux-08-history-expanded-desktop.png` — map history 1024px
- `docs/ux/sprint21-evidence/sprint21-ux-08b-history-card-expanded.png` — card expanded 1024px

## Untested Paths
- Form validation error display (empty submit, invalid email)
- Dark mode visual after save
- Friends feature
- Apple/Google OAuth behavior
- Privacy Policy link destination
- Session completion + share flow

## Knowledge Updates
- Sprint 21: AuthScreen has strong brand identity; registration form clean with social login
- Route selection uses green left-border + checkmark — instant, unambiguous feedback
- Settings uses Save button dirty-state pattern (grey → green)
- MapHistory inline card expansion confirmed working — no full-screen navigation needed
- Zero runtime errors across all navigation paths
- Cross-app toggle consistency confirmed: green/grey/white thumb

## Verdict
No Blocker-level friction. No Critical friction. UX PASS.
