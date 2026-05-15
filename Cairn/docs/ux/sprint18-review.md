# UX Review — Sprint 18

**Sprint**: 18  
**Verdict**: No Blocker or Critical friction  
**Reviewer**: UX subagent  
**Date**: 2026-05-16

## Sprint Goal
Flag drag UX + Home activity strip + UI polish

## Features Reviewed

### STORY-00039: AR Flag Drag Interaction
- **Find it**: FAB button visible bottom-right of map — 1 tap to open picker. ✓ (< 3 action threshold)
- **Use it**: 4 corner flags labelled Danger/Scenic/Water/Junction, drop zone centred with "Drag a flag to the zone · or tap" instruction. Clear affordance.
- **Tap fallback**: Tapping a corner flag opens note sheet immediately. First-time user can complete without drag. ✓
- **Cancel**: Cancel button present and works. ✓
- **Result**: Flag saved, map returns to normal state. ✓
- **UX finding**: Drop zone label "Target zone" with flag icon is clear. Instruction text is appropriately muted.

### STORY-00040: HomeScreen Recent Activity Strip  
- **Find it**: Appears between header and activity cards — prominent placement. ✓
- **Hidden when empty**: Correctly absent with no sessions — no empty-state clutter. ✓
- **Content**: "Run · 2026-05-16" + "0.0 km · 00:25" + chevron. Informative at a glance. ✓
- **Tap**: Navigates to MapHistory — appropriate destination. ✓

### STORY-00041: HikingScreen Topo Art
- **Visual quality**: Concentric rings, mountain silhouettes, trail path line — evokes topographic map. Muted green palette (#e8f4e8) is calm and trail-focused.
- **Labels**: "TRAIL MAP" uppercase + "Real map loads with offline pack" sub-label centred. Sets expectation clearly for offline state. ✓
- **GPS chip + Back chip**: Correctly positioned and functional. ✓
- **Decorative**: No accidental tappability on topo elements. ✓

### STORY-00042: RunningScreen Lock Screen
- **Premium feel**: Dark background, large white elapsed time, subtle secondary stats — comparable to Strava lock screen.
- **GPS indicator**: Green pulsing dot visible above timer. Active/offline state clear. ✓
- **Double-tap hint**: "Double-tap to unlock" with 2 indicator dots — clear affordance. ✓
- **Unlock confirmation**: Stop + Lock Screen controls fade in after double-tap. ✓
- **Stats update**: Timer counts live every second while locked. ✓

## Friction Items

None — Blocker or Critical level.

**Low** (noted, backlog):
- Wake Lock denied on web (expo-keep-awake limitation) — not visible to user, no impact on UX
- Topo map: mountain silhouettes render in bottom-left corner rather than centred — minor aesthetic, not confusing

## Evidence
- `STORY-00039-01-ar-picker-open.png` — AR picker with corner flags and drop zone
- `STORY-00039-02-note-sheet.png` — Note sheet after tap
- `STORY-00040-02-home-with-session.png` — Home with recent activity strip
- `STORY-00041-03-hiking-topo-labels.png` — Topo map with labels
- `STORY-00042-05-lockscreen-live.png` — Lock screen with live timer
- `STORY-00042-02-running-unlocked.png` — Unlocked state with Stop/Lock controls
