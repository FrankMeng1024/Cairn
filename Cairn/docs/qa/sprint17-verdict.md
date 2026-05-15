# QA Verdict — Sprint 17

**Sprint**: 17
**Date**: 2026-05-15
**Verdict**: PASS

## Stories Tested

| Story | Title | Verdict | Confidence |
|-------|-------|---------|------------|
| STORY-00037 | HikingScreen English conversion | PASS | HIGH |
| STORY-00038 | RunningScreen, MapHistoryScreen, FriendsScreen, SettingsScreen English | PASS | HIGH |

## AC Verification

### STORY-00037 — HikingScreen English
- [x] GPS chip: "GPS Offline" — verified in screenshot STORY-00037-04
- [x] Back button: "Back" — verified
- [x] Start button: "Start Hiking" — verified
- [x] Auth splash: "Create Account", "Sign In" — verified STORY-00037-02
- [x] Register form: "Create Account", "Email", "Password", "Confirm Password", "I agree to the Privacy Policy" — all English

### STORY-00038 — Multi-screen English
- [x] RunningScreen: "Running Mode", "Select a route (optional)", "Free Run", "GPS tracking · Any route", "Start Running", "Screen locks on start · Double-tap to unlock" — STORY-00038-01
- [x] MapHistoryScreen: "Route Map", "Back", "Plan", "Route History", "My Flags", "Trail Map", "Route history · Flag markers", "No routes yet", "Your hikes and runs will appear here" — STORY-00038-03
- [x] FriendsScreen: "Friends", "Sharing flags with 3/3 friends", "Toggle sharing individually per friend", "Online · 12 shared flags", "3h ago · 7 shared flags", "Yesterday · 3 shared flags", "Sharing", "Add a friend", "Invite by email" — STORY-00038-04
- [x] SettingsScreen: "Settings", "INTERFACE MODE", "Guided Mode", "Labels everywhere · Beginner-friendly", "Simple Mode", "Icons only · Minimal", "SHARING", "Share flags with new friends by default", "Live location sharing", "DISPLAY", "Night mode", "VOICE GUIDANCE", "Route announcements", "ACCOUNT", "Profile", "Sign Out", "Save Settings" — STORY-00038-05

## Bug Found and Fixed During QA

### BUG-SPRINT17-01 (Blocker — fixed before verdict)
**Description**: MapHistoryScreen crashed on load with "Maximum update depth exceeded" — blank white screen.
**Root cause**: `useMarkerStore(s => s.getMarkersForRegion(region.code))` called a store method inside a Zustand selector, returning a new array reference every render, causing infinite re-render loop.
**Fix**: Changed to `useMarkerStore(s => s.markers)` + filter outside the selector: `allMarkers.filter(m => m.regionCode === region.code)`.
**Status**: Fixed and verified — MapHistoryScreen loads correctly (STORY-00038-03).

## Navigation Regression

All screens tested with navigate-to → navigate-away → navigate-back pattern:
- Home → Hiking → Home: 0 console errors
- Home → Running → Home: 0 console errors
- Home → Map (MapHistory) → Home: 0 console errors
- Home → Friends → Home: 0 console errors
- Home → Settings → Home: 0 console errors

## Performance

No performance issues observed. All screen transitions instant. Zero uncaught JS errors across all flows.

## Evidence

| File | Screen |
|------|--------|
| `docs/qa/sprint17-evidence/STORY-00036-01-auth-splash.png` | Auth splash — English |
| `docs/qa/sprint17-evidence/STORY-00037-02-register-form.png` | Register form — English |
| `docs/qa/sprint17-evidence/STORY-00037-03-home-screen.png` | Home screen — English |
| `docs/qa/sprint17-evidence/STORY-00037-04-hiking-screen.png` | HikingScreen — English |
| `docs/qa/sprint17-evidence/STORY-00038-01-running-screen.png` | RunningScreen — English |
| `docs/qa/sprint17-evidence/STORY-00038-02-maphistory-error.png` | MapHistory crash (pre-fix) |
| `docs/qa/sprint17-evidence/STORY-00038-03-maphistory-fixed.png` | MapHistory fixed — English |
| `docs/qa/sprint17-evidence/STORY-00038-04-friends-screen.png` | FriendsScreen — English |
| `docs/qa/sprint17-evidence/STORY-00038-05-settings-screen.png` | SettingsScreen — English |
