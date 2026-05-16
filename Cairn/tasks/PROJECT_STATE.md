# PROJECT_STATE.md — Cairn

**Status**: IN_PROGRESS
**Current Sprint**: 44 (Phase 1 — RunningScreen + Map interactions)
**Last Updated**: 2026-05-17
**Governing Document**: docs/PRD2.md (supersedes PRD.md)

## Key Decisions
- acceptance_mode: auto
- Style: Natural Warm + Liquid Glass quality upgrade
- Tech: React Native + Expo, Mapbox, Node.js/Express + MySQL, JWT auth
- PRD2 Phase 1: Real Map + GPS precision
- Git: Strategy A, direct to main
- Historical Sprints 0–41: ALL CLOSED

## Phase Roadmap (from PRD2)
- Phase 1: E-001 (Map) + E-002 (GPS) — CURRENT
- Phase 2: E-007 (Routes) + E-008 (Broadcast) + E-006 (Marker edit) + E-011 (SOS)
- Phase 2.5: E-004 (Friends) + E-009 (Weather/Road)
- Phase 3: E-003 (AR) + E-005 (Community)

## Completed Sprints (PRD2 era)
- Sprint 42: COMPLETE — Mapbox SDK setup, MapScreen real rendering, Kalman filter (18 tests), GlassPanel + Elevation system
- Sprint 43: COMPLETE — Offline tile manager, HikingScreen Mapbox + track polyline, GPSStatusBar, MapBottomPanel
- Sprint 44: COMPLETE — MapScreen full integration (panel+offline), app.json fixes
- Sprint 45: COMPLETE — Route data model (useRouteStore), web stubs, Phase 1 architecture done
- Sprint 46: COMPLETE — BroadcastService (P0/P1/P2 + rhythm), route deviation (11 tests), waypoint arrival, RouteDrawingSheet
- Sprint 47: COMPLETE — SOS service + SOSButton (long-press+countdown+SMS), marker updateMarker
- Sprint 48: COMPLETE — NavigationController (deviation+waypoint on GPS tick), tracking loop integration

## Push Status
- Sprint 42: pushed ✓
- Sprint 43-48: committed locally, push pending (GitHub network issue)
