# UX Knowledge — Cairn App

## Product Understanding
The Cairn app helps users track hikes and runs, plant location flags, and share routes with friends. NZ/Global outdoor activity audience. Primary user flow: Auth → Home → Hiking/Running → plant flags → view history.

## Primary User Flow (end-to-end)
1. Auth screen: splash (logo + tagline) → Sign In or Create Account
2. Sign In: email + password + privacy checkbox → navigates to Home
3. Home: greeting + QuickStats + recent activity strip + Hiking/Running cards + Tools
4. Hiking: map placeholder → Start Hiking → GPS tracking + flag planting
5. Settings: Explorer/Navigator mode selector + toggle rows

## Interaction Patterns
- All screens use back-button pill (top-left) for navigation
- Activity cards and entry buttons have spring press animation
- Privacy checkbox requires direct click on the small square element (22×22, ~35px from left)
- Settings Save button activates (green) only when changes are pending

## Sprint 23 Knowledge Updates
- HomeScreen QuickStats: 3-capsule row with colored left-borders (green/blue/orange), stacked bold value + muted unit. Values: session count, total distance, flag count.
- HomeScreen activity strip: pill badge for activity type ("Run"/"Hike") + bold primary stat (duration if dist ≤10m, else distance) + grey secondary date·duration line.
- HikingScreen map placeholder: premium topo-ring illustration on soft sage-green (Colors.primaryBg) background. Trail S-curve, location pin, "Download Map" outlined CTA, "GPS Offline" red pill. Feels intentional, not broken.
- SettingsScreen mode selector: Explorer selected = green 2px border + green tinted bg + checkmark badge. Navigator = grey border + orange compass icon. Section headers are tiny muted caps.
- Navigation regression Home→Hiking→Back and Home→Settings→Back clean. Pre-existing expo-keep-awake Wake Lock warnings unrelated to Sprint 23.

## Sprint 24 Knowledge Updates
- RunningScreen: gradient icon badges (green for Free Run, blue for named routes), blue left-border + tint selected state, h3 title "Running Mode", small subtitle "Select a route (optional)", green "Start Running" button. Consistent with other screens.
- MapHistoryScreen: session cards upgraded to HomeScreen strip style — "Run"/"Hike" pill badge, bold duration primary stat, muted "date · -- km" secondary line, gradient icon badge. Tab selected = primaryBg pill + primary text (not white-on-green). "Route Map" placeholder with Map icon replaces old warning triangle feel.
- FriendsScreen: gradient avatar circles (44×44, primaryLight gradient), 3-tier status dots (green/amber/grey), Flag icon before shared count, sharing summary pill (primaryBg), tinted dashed "Add a friend" card. Visual depth matches Sprint-23 HomeScreen.
- All three secondary screens now share cohesive design language: h3 titles, pill badges, gradient icon accents, shadow cards, muted secondary text.

## Known Friction (Low only)
- Activity card chevron circles (20×20) are small visual affordance — whole card tappable so no functional impact
- "Run" pill badge text at 9px is near mobile legibility floor — supplementary to bold primary stat
- Section headers at FontSize.tiny near accessibility floor — row labels remain full-size
- MapHistoryScreen placeholder persists when sessions visible below — could auto-select first route
- Session cards show "-- km" when no GPS distance — ambiguous for new users
- FriendsScreen instruction text between summary pill and cards could use more spacing
