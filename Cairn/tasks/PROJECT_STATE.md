# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 20 (COMPLETE — next: Sprint 21)
**Last Updated**: 2026-05-15

## Key Decisions
- acceptance_mode: auto
- Style: B (Natural Warm)
- Tech: React Native + Expo, Mapbox, Firebase Auth, WatermelonDB
- Phase 1: No AR (地图pin标记), Phase 2: AR
- Git: Strategy A, direct to main

## Sprint History
- Sprint 0: COMPLETE — Foundation, docs, tech stack, Style B confirmed
- Sprint 1: COMPLETE — Spike Review PASS, 4/4 VIABLE WITH CONDITIONS
- Sprint 6: COMPLETE — HomeScreen SVG redesign (emoji → lucide icons)
- Sprint 7: COMPLETE — RunningScreen SVG redesign + expo-keep-awake
- Sprint 8: COMPLETE — HikingScreen SVG redesign (map markers, flag picker, spring press)
- Sprint 9: COMPLETE — AuthScreen SVG redesign (AnimatedCairn, PressBtn, persistence fix)
- Sprint 10: COMPLETE — MapHistoryScreen SVG redesign (PressRow, tabs, route cards)
- Sprint 11: COMPLETE — FriendsScreen SVG redesign (Users illustration, Mail input, Send button)
- Sprint 12: COMPLETE — SettingsScreen SVG redesign + localStorage uiMode persistence
- Sprint 13: COMPLETE — MapScreen + RoutesScreen SVG cleanup
- Sprint 14: COMPLETE — Phase A: geo-extensible architecture + real GPS tracking stores
- Sprint 17: COMPLETE — Full English UI conversion (NZ/Global), Zustand bug fix
- Sprint 18: COMPLETE — AR flag drag UX, HomeScreen activity strip, topo map, RunningScreen premium lock screen
- Sprint 19: COMPLETE — Session track viz, expert mode, friends polish, map history uplift
- Sprint 20: COMPLETE — HomeScreen QuickStats, HikingScreen polish, session badges, BackButton consistency

## Phase A Status (COMPLETE)
All core GPS tracking functionality wired. Real expo-location GPS, haversineM distance calc, Zustand stores persisted.

## Open Retro Items (from Sprint 20)
- FAB badge context — Low (add tooltip/label for flag count meaning)
- Hide zero-value stats — Low (don't show +0m/0 flags when both zero)
- Auth privacy checkbox UX — Medium (separate checkbox from link text)

## Next Work (Phase B — Firebase + Safety)
- Firebase Auth integration (AuthScreen → real login)
- Firestore marker sync (personal → group/public sharing)
- Cloud session backup
- Phase C: SafetyDataProvider (DOC NZ hazard alerts)
