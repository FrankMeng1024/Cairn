# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 19 (UI quality round 2)
**Last Updated**: 2026-05-16

## Sprint History
- Sprint 0: COMPLETE (2026-05-15) — Foundation, docs, tech stack, Style B confirmed
- Sprint 1: COMPLETE (2026-05-15) — Spike Review PASS，4/4 VIABLE WITH CONDITIONS
- Sprint 6: COMPLETE (2026-05-15) — HomeScreen SVG redesign (emoji → lucide icons)
- Sprint 7: COMPLETE (2026-05-15) — RunningScreen SVG redesign + expo-keep-awake
- Sprint 8: COMPLETE (2026-05-15) — HikingScreen SVG redesign (map markers, flag picker, spring press)
- Sprint 9: COMPLETE (2026-05-15) — AuthScreen SVG redesign (AnimatedCairn, PressBtn, persistence fix)
- Sprint 10: COMPLETE (2026-05-15) — MapHistoryScreen SVG redesign (PressRow, tabs, route cards)
- Sprint 11: COMPLETE (2026-05-15) — FriendsScreen SVG redesign (Users illustration, Mail input, Send button)
- Sprint 12: COMPLETE (2026-05-15) — SettingsScreen SVG redesign + localStorage uiMode persistence
- Sprint 13: COMPLETE (2026-05-15) — MapScreen + RoutesScreen SVG cleanup (orphaned files)
- Sprint 14: COMPLETE (2026-05-15) — Phase A: geo-extensible architecture + real GPS tracking stores
- Sprint 17: COMPLETE (2026-05-15) — Full English UI conversion (NZ/Global), Zustand bug fix
- Sprint 18: COMPLETE (2026-05-16) — AR flag drag UX, HomeScreen activity strip, topo map, RunningScreen premium lock screen
  - HikingScreen: PanResponder drag-from-corners AR flag picker, topo map with Trail Map labels
  - HomeScreen: recent activity strip (hides when no sessions)
  - RunningScreen: premium lock screen (large elapsed, GPS pulsing dot, double-tap unlock)
  - useTrackingStore: locationSubscription.remove() try/catch for web compat

## Phase A Summary (COMPLETE)
All core GPS tracking functionality wired. No hardcoded coordinates anywhere.

## Sprint 19 — Active
Stories: STORY-00043 (session track viz), STORY-00044 (expert mode), STORY-00045 (friends polish), STORY-00046 (map history uplift)

## Next Work (Phase B — Firebase)
- Firebase Auth integration (AuthScreen → real login)
- Firestore marker sync (personal → group/public sharing)
- Cloud session backup
- Phase C: SafetyDataProvider (DOC NZ hazard alerts)

## Key Decisions
- acceptance_mode: auto
- Style: B (Natural Warm)
- Tech: React Native + Expo, Mapbox, Firebase Auth, WatermelonDB
- Phase 1: No AR (地图pin标记), Phase 2: AR
- Test device: iPhone (Expo Go)
- Backend: 122.51.174.118 MySQL
- Git: Strategy A, direct to main


## Sprint History
- Sprint 0: COMPLETE (2026-05-15) — Foundation, docs, tech stack, Style B confirmed
- Sprint 1: COMPLETE (2026-05-15) — Spike Review PASS，4/4 VIABLE WITH CONDITIONS
- Sprint 6: COMPLETE (2026-05-15) — HomeScreen SVG redesign (emoji → lucide icons)
- Sprint 7: COMPLETE (2026-05-15) — RunningScreen SVG redesign + expo-keep-awake
- Sprint 8: COMPLETE (2026-05-15) — HikingScreen SVG redesign (map markers, flag picker, spring press)
- Sprint 9: COMPLETE (2026-05-15) — AuthScreen SVG redesign (AnimatedCairn, PressBtn, persistence fix)
- Sprint 10: COMPLETE (2026-05-15) — MapHistoryScreen SVG redesign (PressRow, tabs, route cards)
- Sprint 11: COMPLETE (2026-05-15) — FriendsScreen SVG redesign (Users illustration, Mail input, Send button)
- Sprint 12: COMPLETE (2026-05-15) — SettingsScreen SVG redesign + localStorage uiMode persistence
- Sprint 13: COMPLETE (2026-05-15) — MapScreen + RoutesScreen SVG cleanup (orphaned files)
- Sprint 14: COMPLETE (2026-05-15) — Phase A: geo-extensible architecture + real GPS tracking stores
  - src/config/regions.ts (Region interface, NZ config, getCurrentRegion)
  - src/utils/geo.ts (haversineM, formatDistance, formatDuration, calculateElevationGain)
  - src/store/useMarkerStore.ts (local marker persistence)
  - src/store/useSessionStore.ts (completed session persistence)
  - src/store/useTrackingStore.ts (live GPS via expo-location, web fallback)
  - HikingScreen: real GPS start/stop, real markers plant/delete, live stats
  - RunningScreen: real tracking store, live distance/duration/pace
  - MapHistoryScreen: real sessions + real markers, empty states
- Sprint 17: COMPLETE (2026-05-15) — Full English UI conversion (NZ/Global)
  - All 7 screens converted: HikingScreen, RunningScreen, MapHistoryScreen, FriendsScreen, SettingsScreen, MapScreen, RoutesScreen
  - mockData.ts: MARKER_META labels, MOCK_FRIENDS, MOCK_MARKERS all English
  - BUG FIX: MapHistoryScreen Zustand selector infinite re-render (useMarkerStore selector was calling function)
  - QA PASS: 9 screenshots, 0 console errors

## Phase A Summary (COMPLETE)
All core GPS tracking functionality wired. No hardcoded coordinates anywhere.
expo-location used on device; graceful web fallback (timer works, GPS shows offline).
Sessions saved to cairn_sessions, markers to cairn_markers, trackPoints to cairn_trackpoints_{id}.

## Next Work (Phase B — Firebase)
- Firebase Auth integration (AuthScreen → real login)
- Firestore marker sync (personal → group/public sharing)
- Cloud session backup
- Phase C: SafetyDataProvider (DOC NZ hazard alerts)

## Key Decisions
- acceptance_mode: manual
- Style: B (Natural Warm)
- Tech: React Native + Expo, Mapbox, Firebase Auth, WatermelonDB
- Phase 1: No AR (地图pin标记), Phase 2: AR
- Test device: iPhone (Expo Go)
- Backend: 122.51.174.118 MySQL
- Git: Strategy A, direct to main
