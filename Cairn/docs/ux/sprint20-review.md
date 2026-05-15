# UX Review — Sprint 20

**Date**: 2026-05-15  
**Reviewer**: UX subagent (first-time user perspective, claude-opus-4-6)  
**Confidence**: HIGH

## Sprint Goal
UI quality uplift: HomeScreen quick stats, HikingScreen stats hierarchy, session cards, cross-screen BackButton consistency.

## Friction Items

| Severity | Description | Screenshot | Resolution |
|----------|-------------|------------|------------|
| Medium | "1 sessions" — incorrect pluralization in QuickStats capsule | home-quickstats.png | **Fixed**: pluralization logic added (1 session / N sessions, 1 flag / N flags) |
| Medium | FAB badge "1" on Hiking screen — first-time user unclear if this means flags planted, flags nearby, or notifications | hiking-idle.png | Backlog — add tooltip or label in Sprint 21 |
| Low | "GPS Offline" pill offers no guidance on what a user should do | hiking-idle.png | Backlog |
| Low | Back button position inconsistency: pill top-right on map screens vs inline top-left on list screens | hiking-idle.png | Intentional design pattern — documented |
| Low | "+0m elev · 0 flags" shows zero values on run session — noise for first-time user | home-quickstats.png | Backlog — consider hiding zero-value stats |

## Positive Observations
- "Good evening, Explorer" greeting is warm and personal — creates immediate connection
- QuickStats capsules are scannable at a glance; colored icons (green/blue/orange) create clear visual taxonomy
- "Start Hiking" button is unmistakable in purpose — no confusion
- Session card activity badge (circular person/mountain icon) adds real clarity for distinguishing run vs hike
- Visual consistency is strong across all 5 screens — warm beige, green accent, card shadows all cohesive
- Hiking/Running cards on Home use distinct icon+color coding — intuitive visual shorthand

## Evidence Files
- `docs/ux/sprint20-evidence/home-quickstats.png`
- `docs/ux/sprint20-evidence/hiking-idle.png`
- `docs/ux/sprint20-evidence/maphistory-sessions.png`
- `docs/qa/sprint20-evidence/STORY-00050-02.png` (Settings)
- `docs/qa/sprint20-evidence/STORY-00050-03.png` (Friends)

## Untested Paths
- Running screen idle state
- Navigation transition animations
- State after completing a hike/run
- FAB flag planting interaction flow

## Verdict
No Blocker-level friction. Medium pluralization issue fixed before sign-off. UX PASS.
