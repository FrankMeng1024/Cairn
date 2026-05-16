# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 38 (PLANNING)
**Last Updated**: 2026-05-16

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
- Sprint 21: COMPLETE — AuthScreen premium redesign, HomeScreen empty state, Running UX polish, cross-screen micro-interactions

- Sprint 27: COMPLETE — UX polish: PlayCircle icon, No GPS clean label, RoutesScreen premium uplift + nav fix, MapHistory auto-select, HikingScreen back button
- Sprint 28: COMPLETE — Token audit (7 new semantic tokens), AuthScreen input focus states, RunningScreen triple-signal selection, SettingsScreen 11px headers + Colors.night, overlay opacity standardization
- Sprint 29: COMPLETE — Token completion (7 more tokens), Sign In auto-focus, RoutesScreen Download affordance, FlagPlantSheet note focus + char count
- Sprint 30: COMPLETE — RoutesScreen date formatting, FlagPlantSheet char counter amber warning, Create Account Name auto-focus, Settings hint pill animation, HomeScreen contextual subtitle
- Sprint 31: COMPLETE — MapScreen premium uplift: topo placeholder, CreateMarkerSheet 4-card grid + LinearGradient, MarkerDetailSheet gradient badge, tracking bar left-border, rgba chip overlay standard
- Sprint 32: COMPLETE — AuthScreen password visibility toggle, haptic polish, char counter 30-char limit, FriendsScreen banner polish, SettingsScreen logout button
- Sprint 33: COMPLETE — GPS pulse animation (HikingScreen + MapScreen), expo-haptics integration, "Max 30 characters" label + 22/30 amber threshold, MapHistoryScreen "Preview" label + stagger expand, FriendsScreen entrance animation, HomeScreen nudge card
- Sprint 35: COMPLETE — Real auth foundation: Node.js/Express backend + JWT auth + MySQL schema; frontend AuthScreen UI polish; authService.ts + tokenStore.ts wired; Google OAuth deferred to Sprint 36

- Sprint 36: COMPLETE — Live auth E2E (MySQL running, register/login/JWT restore/sign out); Auth UX polish (privacy on Sign In removed, welcome state); backend input validation + {error} key standardised
- Sprint 37: COMPLETE — User data ownership: sessions table + REST API (STORY-00125); sessionService + authenticatedFetch (STORY-00126); Settings profile display (STORY-00127); JWT 401 auto-logout (STORY-00128). STORY-00122 Google OAuth BLOCKED pending Client ID.

 Real expo-location GPS, haversineM distance calc, Zustand stores persisted.

## VU Prerequisites Status
- Must-Have items 1–5, 8–10: DONE
- Must-Have items 6 (DOC risk layer) + 7 (route deviation + voice alerts): Phase B/C — NOT YET IMPLEMENTED
- VU trigger deferred until Phase B integration complete

## Open Retro Items
- [Sprint 22] FAB badge tooltip/label for flag count context (Low)
- [Sprint 22] Hide zero-value secondary stats ("+0m · 0 flags") (Low)
- [Sprint 22] 0.0 km stat showing — zero-value session display (Medium — from UX Sprint 21)

## Next Work (Phase B — Firebase + Safety)
- Firebase Auth integration (AuthScreen → real login)
- Firestore marker sync (personal → group/public sharing)
- Cloud session backup
- **REVISED (CR-004, Sprint 35)**: Using custom Node.js/Express + MySQL backend instead of Firebase Auth. Sprint 35 executes: real backend, JWT email auth, Google OAuth, AuthScreen UI polish.
- Phase C: SafetyDataProvider (DOC NZ hazard alerts)

## Ongoing: UI Quality Optimization
Sprint 22+ continues frontend UI detail polishing (user directive: iterate until quality 10/10).
