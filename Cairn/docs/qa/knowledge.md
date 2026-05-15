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

## Sprint 23 Verification Summary

- STORY-00059 (HomeScreen activity cards + QuickStats): PASS HIGH
- STORY-00060 (HikingScreen premium map placeholder): PASS HIGH
- STORY-00061 (SettingsScreen mode selector refinement): PASS HIGH
- STORY-00062 (RecentActivityStrip typography): PASS MEDIUM (distance > 10m branch untested)
