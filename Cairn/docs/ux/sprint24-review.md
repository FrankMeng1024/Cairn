# UX Review — Sprint 24

**Confidence**: HIGH
**Reviewer**: UX subagent (claude-opus-4-6)
**Date**: 2026-05-15
**Viewport**: 390px

## Friction Items

| Severity | Description | Screenshot |
|----------|-------------|------------|
| Low | MapHistoryScreen center placeholder ("Select a route below to view") persists even when session cards are visible. First-time user might wonder if the map is broken. Consider auto-selecting first route or making placeholder conditional on zero sessions. | maphistory-01.png |
| Low | Session cards show "-- km" for distance — no context for whether this means "not recorded", "zero", or "unavailable". A micro-label or omitting the field when empty would reduce ambiguity. | maphistory-01.png |
| Low | FriendsScreen: "Toggle sharing individually per friend" instruction text between summary capsule and cards reads as a subtitle rather than an instruction. Minor spacing/weight tweak would strengthen hierarchy. | friends-01.png |

## What Works Well
- All three screens now share cohesive design language with HomeScreen: h3 titles, pill badges, gradient icon accents, shadow-elevated cards, muted secondary text
- RunningScreen: gradient badges, blue left-border selected state, restrained h3 title — feels premium
- FriendsScreen: gradient avatar circles, online/offline dots, sharing summary capsule — warm and personal
- MapHistoryScreen: activity pill badges + bold duration primary stat matches HomeScreen activity strip pattern exactly
- Navigation regression clean across all screens. Zero new console errors.

## Untested Paths
- RunningScreen "Start Running" flow (not in Sprint 24 scope)
- MapHistoryScreen: tapping a session card to load route on map
- FriendsScreen: toggling sharing OFF and counter updating
- FriendsScreen "Add a friend" tap flow

## Verdict
No Blocker or Critical friction. Sprint 24 goal achieved — secondary screens now at Sprint-23 quality level. All Low items are polish suggestions for a future sprint, not usability blockers.
