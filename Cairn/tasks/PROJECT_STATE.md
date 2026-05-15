# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 14-16 (Phase A complete)
**Last Updated**: 2026-05-15

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
