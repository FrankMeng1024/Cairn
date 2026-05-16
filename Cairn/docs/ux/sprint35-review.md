# UX Review — Sprint 35

**Sprint**: 35
**Sprint Goal**: Real auth foundation
**UX Subagent**: claude-opus-4-6 (a4ea8c1de0c515c42)
**Date**: 2026-05-16
**Overall**: No Blocker or Critical friction found. Auth flow is clean, trustworthy, and navigable.

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Medium | Privacy checkbox present on Sign In (returning users) as well as Create Account. Requiring privacy acknowledgment on every sign-in adds unnecessary friction for returning users. Most apps require this only at registration. | STORY-00117-09-signin-390 |
| Low | Create Account subtitle "You'll start in Explorer mode. Switch anytime in Settings." — first-time users have no context for what Explorer mode is. Mild confusion without value at this stage. Consider replacing with a benefit statement. | STORY-00117-07-create-account-390 |
| Low | Error banner "Cannot reach server. Check your connection." implies user fault when the issue may be server-side. More neutral: "Unable to connect. Please try again." | STORY-00119-12-error-banner |
| Low | Cairn icon inline-left of title at scale 0.5 reads as decorative clutter on sub-screens. Splash already establishes brand with large centered icon — repeated small icon may dilute rather than reinforce. | STORY-00117-07-create-account-390 |

## Positive Observations

- Button hierarchy correct: green filled primary (Sign In) + outlined secondary (Create Account) — no confusion about which to press
- Visual language (stacked stones, earth tones, green CTAs) immediately communicates outdoor/nature — establishes trust
- Error state preserves form values + non-blocking banner — excellent recovery pattern for intermittent connectivity
- Social auth buttons with platform-aware messaging (iOS requirement note, coming soon) — honest and appropriate
- Navigation: Splash ↔ Sign In ↔ Create Account back-button behavior clean, 0 JS errors

## Untested Paths

- Post-registration landing — what user sees immediately after successful account creation
- Password validation feedback timing (before or only after failed attempt)
- Keyboard scroll behavior — form scrollability when virtual keyboard appears
- Landscape orientation
- Privacy Policy link behavior — inline expansion vs navigation (form state preservation)

## Verdict

**PASS** — No Blocker or Critical items. Medium item (privacy checkbox on Sign In) logged for backlog. Three Low items logged for backlog.
