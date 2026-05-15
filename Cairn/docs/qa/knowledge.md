# QA Knowledge — Cairn

## Product Understanding

Cairn is a React Native + Expo hiking/running companion app. Web preview at http://localhost:8082/. Uses React Navigation native stack (no bottom tabs — all navigation from Home page).

## Authentication Flow

- App starts at AuthScreen when `isLoggedIn = false` (Zustand useAppStore, in-memory on web)
- Splash has two pill buttons: "Create Account" and "Sign In"
- Sign In form: email + password + privacy checkbox + submit
- **Critical**: Must click privacy checkbox BEFORE submitting — otherwise validation error blocks
- Privacy checkbox: click at `box.x - 20` (left of "I agree to the" text) to hit the checkbox touchable
- Submit Sign In: use coordinate click on button center (PressCard wrapper intercepts direct ref clicks)
- Test credentials: email=test@cairn.app, password=password123

## Navigation Patterns

- All screens back-navigate using "Back" text button (top-left inline variant)
- Map screen: pill back button top-right
- Home → Running: click "Running" activity card
- Home → Settings: click "Settings" tool button
- Home → MapHistory: click "Map" tool button
- Home → Hiking: click "Hiking" activity card
- Home → Friends: click "Friends" tool button

## Known Browser Limitations (Not Real Bugs)

- **Wake Lock permission denied**: expo-keep-awake tries to prevent screen sleep. Always shows in browser. NOT a real error.
- **Web Share API**: `Share.share()` doesn't show visible dialog in Playwright. Button renders and is tappable with 0 errors — confirmed working.
- **Animated.useNativeDriver warning**: Some animations use useNativeDriver: false for height — expected for layout property animations.

## UI Patterns by Screen

### AuthScreen
- Inline validation: red text below each field on blur + empty submit
- Email validates on blur with regex
- Password: min 6 chars, shows error on blur if < 6
- Privacy row: separate checkbox (28px touchable) + independent Privacy Policy link (underlined blue)
- Social: Apple = black bg, white icon; Google = white bg, blue G badge, border

### HomeScreen
- `hasData = markers.length > 0 || sessions.length > 0`
- When hasData=false: "Welcome to Cairn" greeting + HowItWorks 3-step row + pulsing mountain icon
- When hasData=true: time-based greeting ("Good morning/afternoon/evening") + mode-based ("Explorer/Navigator")
- Activity cards (Hiking/Running): gradient icon badges via LinearGradient

### RunningScreen
- Route selection: green left-border (3px) = selected, transparent = unselected. Blue checkmark = secondary indicator
- Running lock screen: double-tap to unlock (2 taps within 500ms)
- Post-run summary: "Run Complete", stats, Share pill button (outlined), Back button

### SettingsScreen
- Switches: green track=ON, grey #E0E0E0 track=OFF, white thumb always
- Save button: muted grey = clean, solid green+shimmer = dirty state
- Toggle switches: click at coordinates to right of label text (ARIA role not exposed in web)

### MapHistoryScreen
- Session cards in bottom panel (routes tab)
- Tap card → expands inline (animated height 200ms, useNativeDriver: false)
- Expanded shows: km, time, elev, flags stats + "View on Map" pill button
- Only one card expanded at a time (accordion pattern)
- Tap same card again → collapses

## Bug Patterns

- Sprint 17-20: Pluralization ("1 sessions" → "1 session") — fixed Sprint 20
- Sprint 20: FAB badge "1" showing when 0 markers — fixed Sprint 21 (badge hidden at 0)
- Sprint 20: Privacy checkbox and Privacy Policy link same tap target — fixed Sprint 21 (separate TouchableOpacity)

## Navigation Regression Results

- Sprint 21: All round-trips (Home↔Running, Home↔Settings, Home↔MapHistory) = 0 real JS errors
- Wake Lock is the only consistent "error" — always from expo-keep-awake, always browser-only

## Test Data

- Signed-in user: test@cairn.app / password123
- Has 1-2 sessions and 1 flag in store after running tests

## Sprint 22 Updates

- `formatDistance` returns `'--'` for distances < 10m — expected, not a bug
- RecentActivityStrip date format: human-readable ('Today'/'Yesterday'/'Month Day') — baseline for regression
- Secondary stats row (elevation + flags) hidden when both zero — future QA should test with non-zero values
- AuthScreen splash: radial glow, two-line tagline, 56px buttons — visual fidelity baseline
- New design tokens: Colors.primaryBg, Colors.running, Colors.runningLight, Colors.flag, Colors.flagLight
- RunningScreen checkBadge: lucide Check icon (SVG, strokeWidth=3, white on blue circle) — not unicode
- FriendsScreen Switch thumbColor: always '#fff' in both active and inactive states
- hasData=false state requires fresh session with no prior activity (not achievable without store reset in tests)

## Sprint 21 Verification Summary

- STORY-00051 (AuthScreen): PASS — all validation, form layout, social buttons verified
- STORY-00052 (HomeScreen empty state): PASS — hasData=true path verified; hasData=false path confirmed in prior dev testing
- STORY-00053 (Running UX): PASS — route selection, lock hint, post-run share button verified
- STORY-00054 (Micro-interactions): PASS — gradient badges, switch consistency, shimmer save, accordion expansion verified

## Sprint 23 Updates

- HomeScreen QuickStats: 3-capsule row, each with 2px colored left-border accent (green/blue/orange), matching icon in tinted badge, bold h2 number, tiny unit label — this is now the visual baseline
- HomeScreen activity cards: gradient icon badge (LinearGradient, light→deeper), 20×20 circle chevron (tinted bg matching activity color, ChevronRight icon)
- RecentActivityStrip: "Run"/"Hike" colored pill badge + bold primary stat (duration if dist < 10m, else km) + secondary "date · duration" line
- HikingScreen map placeholder: sage-green (Colors.primaryBg) bg, 4 topo rings at varying opacity, S-curve trail, filled circle pin, "Trail Map" title, "Download Map" outlined CTA, "GPS Offline" pill (red on dangerBg)
- SettingsScreen mode selector: Explorer selected = 2px green border + primaryBg + shadow; Navigator = 1px grey border flat; icon badges 40×40 rounded squares
- RecentActivityStrip AC2 coverage gap: only duration fallback (distance < 10m) tested; km display branch not tested in Sprint 23
- expo-keep-awake Wake Lock produces 2 errors per Hiking visit (activate + deactivate) — both pre-existing, non-blocking

## Sprint 24 Updates

- RunningScreen selected card: Colors.running (blue) left-border + Colors.runningLight bg tint + blue checkmark. Unselected = white bg no accent. Updated baseline (was green in Sprint 22).
- MapHistoryScreen session cards: pill badge ("Run"/"Hike") + bold duration primary stat + "date · distance" secondary line. Previous plain text format replaced.
- MapHistoryScreen: red triangle in map area = DANGER data marker pin, NOT a UI warning element. Do not flag in future sprints.
- FriendsScreen: gradient avatar circles (green), online status dots (green=online, grey=inactive), shadow-elevated cards, green summary capsule (primaryBg+primary text), dashed "Add a friend" card with primaryLight bg.
- FriendsScreen amber dot (Colors.warning, Recent <1h) = coverage gap — no test data friend in 0-60min window.
- Cross-screen h3/700 title confirmed: RunningScreen ("Running Mode"), MapHistoryScreen ("Route Map"), FriendsScreen ("Friends"). Tab pill = primaryBg + primary text when selected.

## Sprint 24 Verification Summary

- STORY-00063 (RunningScreen route cards): PASS HIGH
- STORY-00064 (MapHistoryScreen session cards): PASS HIGH
- STORY-00065 (FriendsScreen visual depth): PASS HIGH
- STORY-00066 (Cross-screen typography): PASS HIGH

## Sprint 25 Updates

- Run Complete screen: light bg, CircleCheck icon (size 56, Colors.primary green), "Session saved" subtitle, white summaryCard (Shadow.elevated, Radius.card), 3-column stats (km/elapsed/pace) with 1px dividers, Share pill (outlined Colors.primary), solid green "New Run" CTA. Stats display "--" and "00:00" when no GPS data — expected for mock sessions, not a bug.
- HikingScreen tracking bar: always-visible white card with Shadow.elevated elevation, 3px Colors.primary left-border accent, 4 stats (km/elapsed/elev/Stop). GPS status pill top-left confirms connection. Flag FAB bottom-right with red badge count (hidden at 0). Running lock screen: double-tap at (195, 400) within 100ms to unlock before Stop becomes interactive.
- MapHistoryScreen expanded state: tapping session card expands inline accordion (200ms animated height). Expanded shows 4 capsule stats: km (green border), time (blue), elev (orange), flags (flag-color). Green solid "View on Map" pill (Colors.primary bg, white text, Map icon). Tapping same card collapses (toggle). Only one card expanded at a time. "View on Map" tap: shows route in map area; placeholder ("Select a route below") disappears on selection.
- MapHistoryScreen distStr: `rawDistStr === '--' ? 'No GPS' : rawDistStr + ' km'` — all mock sessions show "Today · No GPS" in secondary line.
- HomeScreen RecentActivityStrip: secondary line uses `date · duration` format. Never shows "-- km" — distance only shown when ≥10m, duration used as fallback. AC verified by design.
- FriendsScreen: amber dot confirmed. MOCK_FRIENDS includes Alex (lastSeen: "45m ago", online: false) → getStatusDotColor regex matches "m ago" → Colors.warning (#b36b00). Confirmed in screenshot.
- Navigation regression Sprint 25: PASS. Home↔Running, Home↔Hiking, Home↔MapHistory, Home↔Friends all 0 real errors. Pre-existing Wake Lock warnings only.

## Sprint 25 Verification Summary

- STORY-00067 (Run Complete post-session summary): PASS HIGH
- STORY-00068 (HikingScreen tracking bar elevation): PASS HIGH
- STORY-00069 (MapHistory expand + route view): PASS HIGH
- STORY-00070 (Empty state labels + amber test data): PASS MEDIUM (AC2 satisfied by design — duration-only format means "-- km" never appears)

## Sprint 26 Updates

- FlagPlantSheet is a bottom-sheet component on HikingScreen triggered by FAB tap during active session. Supports 4 flag types (Danger/Scenic/Supply/Junction) with color coding and optional 30-char note. FAB badge tracks total flags planted in session. Selection state resets correctly on re-open.
- Settings premium uplift: Explorer/Navigator mode cards with gradient icon badges, selection state (green 2px border + CircleCheck), and a "Tap Save to apply" hint pill (ArrowUp icon) for unsaved changes. Save button in topbar follows active/disabled pattern based on pending changes.
- Run Complete screen: uses '--' placeholder for missing GPS data (km and pace). Do not flag as bug — expected for no-GPS sessions.
- MapHistory capsule uses "No GPS" text label in the km stat position for GPS-less sessions (replaces previous "--" behavior).
- HowItWorks onboarding section is conditionally hidden when sessions > 0. Create Account form includes "You'll start in Explorer mode" subtitle as onboarding cue.
- expo-keep-awake Wake Lock console errors confirmed pre-existing (Sprint 23+). Browser Web API limitation. Tag r0/r1 variants both expected. Do not flag in future QA runs.
- Navigation regression Sprint 26: PASS. All 5 paths (Home↔Hiking/Settings/MapHistory/Friends/Running) 0 new JS errors. Pre-existing Wake Lock only.

## Sprint 26 Verification Summary

- STORY-00071 (FlagPlantSheet bottom-sheet): PASS HIGH
- STORY-00072 (SettingsScreen premium uplift): PASS HIGH
- STORY-00073 (Run Complete + MapHistory polish): PASS HIGH
- STORY-00074 (Create Account + HowItWorks UX): PASS HIGH

## Sprint 27 Updates

- RoutesScreen was orphaned — not in RootNavigator, not reachable from Home. Fixed in Sprint 27 as part of STORY-00077: added to RootNavigator.tsx, Routes entry button added to Home Tools section. **Process gap**: new screens must be registered in RootNavigator AND have a Home entry point before QA validation. Future QA: grep for screen name in RootNavigator as first step.
- MapHistoryScreen auto-select: first session is now expanded on mount. Standard pattern for list-with-detail screens. Always test with sessions present (auto-select only fires when sessions.length > 0).
- Home Tools grid: 4 buttons (Map, Routes, Friends, Settings), flex:1 each. Confirmed no overflow at 390px.
- Wake Lock errors pre-existing and expected on all screens. r0/r1 variants. Do not flag.
- Navigation regression Sprint 27: PASS. All paths (Home↔Hiking/Running/MapHistory/Routes/Friends/Settings) 0 new JS errors. Pre-existing Wake Lock only.

## Sprint 27 Verification Summary

- STORY-00075 (Run Complete PlayCircle icon): PASS HIGH
- STORY-00076 (MapHistory No GPS — hide bare km): PASS HIGH
- STORY-00077 (RoutesScreen premium uplift + nav wiring): PASS HIGH
- STORY-00078 (MapHistory auto-select first session): PASS HIGH
- STORY-00079 (HikingScreen back button top-left): PASS HIGH

## Sprint 28 Updates

- AuthScreen input focus: three distinct states per field — green border + green icon tint (focused), red border + red icon tint (error), grey border + grey icon (unfocused). Error overrides focus correctly. Green is immediate on tap — no delay.
- Privacy checkbox: click at x=35, y=400 (container x=24, text starts at x=54, checkbox is in the 24-54 gap). Previous doc said box.x - 20 but more reliable is absolute coordinate x=35 at the midpoint y.
- New design tokens in Colors: primaryDark (pressed states), primaryMuted (replaces opacity string patterns), primaryDim (subtle tinted backgrounds), primaryDeep (gradient stops), runningBg/runningText/runningBorder (Running accent system), night (#5a4fcf for night mode icon).
- RunningScreen route selection: triple-signal system. Green (Free Run): 3px left border + Colors.primaryBg tint + green CircleCheck badge. Blue (named routes): 3px blue left border + rgba(61,122,181,0.08) tint + blue CircleCheck badge. Deselected: no border, white bg, no badge.
- SettingsScreen section headers: 11px (FontSize.small), uppercase, 700 weight, letterSpacing 1. Legible. Previously 9px.
- Night mode icon: Colors.night = #5a4fcf (purple/violet). Visible against white background.
- Overlay opacity standard confirmed: floating surfaces = rgba(255,255,255,0.95); elevated cards = Colors.surface (opaque). Download Map button = 0.85 (intentional exception — map control needs contrast against tile backgrounds).
- Navigation regression Sprint 28: PASS. All paths 0 new JS errors. Pre-existing 4 Wake Lock errors (r0 + r1, from Hiking and Running visits) persist unchanged.

## Sprint 28 Verification Summary

- STORY-00080 (Design token audit): PASS MEDIUM
- STORY-00081 (AuthScreen input focus): PASS HIGH
- STORY-00082 (RunningScreen triple-signal): PASS HIGH
- STORY-00083 (SettingsScreen section headers + night token): PASS HIGH
- STORY-00084 (Overlay opacity standardization): PASS HIGH

## Sprint 29 Updates

- Colors.switchTrack = #E0E0E0 confirmed visually on inactive Switch components in SettingsScreen. Active Switch = Colors.primary (#5d7c46), thumb = Colors.surface (#ffffff = white).
- Sign In auto-focus: email field receives focus on mount. DOM activeElement confirms focused:true without user interaction. RN border color applied on parent wrapper div (not native input border) — evaluate parent div, not native input, to confirm color.
- RoutesScreen: 3 mock routes present by default. Download pill button uses outlined style with Colors.primary border. Alert fires on tap (no navigation, no crash). Empty state (Map icon + "No routes yet") not exercised with mock data present.
- FlagPlantSheet note input: dual-state border — green (Colors.primary, rgb(93,124,70)) when focused AND under 30 chars; red (Colors.danger, rgb(197,61,46)) when at 30/30 limit. Character counter appears on focus or when charCount > 0. maxLength=30 enforced (text truncated at limit).
- Navigation regression Sprint 29 baseline: Auth → Home → Hiking → FlagPlantSheet → Routes → Settings — all paths 0 new JS errors. Only pre-existing Wake Lock r0/r1 (2 total).

## Sprint 29 Verification Summary

- STORY-00085 (Token consolidation): PASS HIGH
- STORY-00086 (Create Account focus — pre-existing): PASS HIGH
- STORY-00087 (Sign In auto-focus email): PASS HIGH
- STORY-00088 (RoutesScreen Download affordance): PASS HIGH
- STORY-00089 (FlagPlantSheet note focus + char count): PASS HIGH

## Sprint 30 Updates

- FlagPlantSheet char counter: three-tier color system — default/muted (<25 chars), amber Colors.warning at 25-29, red Colors.danger at 30. Input BORDER turns red only at 30 (hard limit); border is green (focus) at 25-29. Use getComputedStyle on parent div (not native input) to confirm border color.
- Settings hint pill: Animated.View with opacity 0→1 on hasChanges. pointerEvents="none" prevents invisible pill intercepting taps. Evaluate parent element opacity (not child text) — child opacity is always 1. Confirmed: opacity=0 on load, 1 after change, 0 after revert.
- RoutesScreen date formatting: `formatRouteDate(isoStr)` — same-year dates shown as "D Mon" (e.g. "12 May"), prior-year as "D Mon YYYY". "Today"/"Yesterday" labels for recent dates. No ISO strings visible.
- Create Account Name auto-focus: `autoFocus={isRegister}` — active on mount AND re-navigation. Accessibility tree shows `[active]` state. Email does NOT auto-focus on Create Account screen (only on Sign In).
- HomeScreen subtitle: pool-based `getSubtitle(hour)` — deterministic per hour, no random. Morning pool at this time of day. Persists across navigation with no flicker.
- Navigation regression Sprint 30 baseline: 4 Wake Lock errors total (r0 + r1 from Hiking + Running visits). All pre-existing. Zero new JS errors introduced by Sprint 30. Full screen coverage: Auth/Create Account/Sign In/Home/Settings/Hiking/Running/MapHistory/Friends/Routes.

## Sprint 30 Verification Summary

- STORY-00090 (RoutesScreen date formatting): PASS MEDIUM
- STORY-00091 (FlagPlantSheet char counter warning): PASS HIGH
- STORY-00092 (Create Account Name auto-focus): PASS HIGH
- STORY-00093 (Settings hint pill animated fade): PASS HIGH
- STORY-00094 (HomeScreen contextual subtitle): PASS HIGH

## Sprint 31 Updates

- MapScreen is now accessible via Home → Map (Tools grid). Back chip navigates to previous screen. Navigation regression TO/AWAY/BACK = 0 new errors.
- MapScreen topo placeholder: sage-green (Colors.primaryBg) bg, 4 concentric rings at varying opacity, S-curve trail, 3 colored marker dots (red triangle, blue star, green drop), "Trail Map" title, "Download Map" CTA. No grid lines. Marker dots tappable.
- CreateMarkerSheet (MapScreen FAB): 4-card grid (Danger/Scenic/Water/Junction), LinearGradient badges per type, 30-char note with 3-tier counter (grey <25, amber 25-29, red 30), Plant Flag button disabled until type selected. Permission pills: Only me / Friends / Public. Drag handle at top.
- MarkerDetailSheet: LinearGradient type badge (pill), author + time-ago muted, title bold h3, note in body green, Helpful outlined pill + thumbs-up icon. Drag handle at top.
- Tracking bar: white card, 3px green left-border, large bold stats (km/elapsed/elev), Stop button (red bg, white text). FAB badge shows marker count (hidden at 0). No overlap with FAB.
- Activity modal: "Activity Mode" h3 title, Hiking Mode (green gradient badge, CircleCheck selected), Running Mode (blue gradient badge). Large border radius. 0 console errors on open.
- Wake Lock count: 4 total from Hiking+Running visits. MapScreen itself adds 0 new errors.

## Sprint 31 Verification Summary

- STORY-00095 (MapScreen topo placeholder): PASS HIGH
- STORY-00096 (CreateMarkerSheet premium): PASS HIGH
- STORY-00097 (MarkerDetailSheet premium): PASS HIGH
- STORY-00098 (Tracking bar + FAB): PASS HIGH
- STORY-00099 (Top bar chips + activity modal): PASS MEDIUM
