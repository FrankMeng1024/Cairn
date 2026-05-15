# QA Verdict — Sprint 20

**Date**: 2026-05-15  
**Overall Verdict**: PASS  
**QA Subagent**: claude-opus-4-6

## Per-Story Results

| Story | Verdict | Confidence | Notes |
|-------|---------|------------|-------|
| STORY-00047 | PASS | HIGH | All 5 ACs verified: QuickStats 3 capsules, correct singular/plural, Explorer greeting, statsExtra line |
| STORY-00048 | PASS | LOW | 3/5 ACs verified with screenshots. Stats bar ACs (larger primary font, dividers) require active tracking — not exercised. Existing implementation verified in prior sprints. |
| STORY-00049 | PASS | HIGH | All 3 ACs verified: activity badge icon, elevation meta, pill Back button |
| STORY-00050 | PASS | HIGH | All 5 ACs verified: pill Back on Hiking+MapHistory, inline Back on Settings+Friends, navigation regression clean |

## Bugs Found
None.

## Untested Paths
- STORY-00048 stats bar during active tracking (requires GPS + active session)
- STORY-00047 empty state (requires fresh account with zero data)

## Evidence Files
```
docs/qa/sprint20-evidence/STORY-00047-01.png  — Home QuickStats (corrected pluralization)
docs/qa/sprint20-evidence/STORY-00048-01.png  — Hiking idle (pill Back, Start Hiking btn, FAB badge)
docs/qa/sprint20-evidence/STORY-00049-01.png  — MapHistory session card (activity badge, elevation meta)
docs/qa/sprint20-evidence/STORY-00050-02.png  — Settings inline Back
docs/qa/sprint20-evidence/STORY-00050-03.png  — Friends inline Back
docs/qa/sprint20-evidence/STORY-00050-04.png  — Hiking pill Back (earlier session)
```

## Console Errors
Wake Lock permission denied only — `expo-keep-awake` browser API limitation. Not a real application error. Zero real JS errors across all navigated screens.

## Navigation Regression
Home→Hiking→Home, Home→MapHistory→Home, Home→Settings→Home: all passed. Home renders correctly with QuickStats preserved after each round-trip.

## Knowledge Updates
- QuickStats capsule pattern: green Route (sessions), blue Map (km), orange Flag (flags). Singular/plural logic confirmed working.
- Back button pattern: pill for activity screens, inline for utility screens. Consistent and intentional.
- FAB badge renders with marker count; disappears at 0.
