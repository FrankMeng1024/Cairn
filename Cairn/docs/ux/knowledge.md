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

## Sprint 25 Knowledge Updates
- Run Complete screen: centered green checkmark (size 56, primary green) + "Session saved" subtitle + white summary card (3 stats: km/elapsed/pace with dividers) + Share pill (primary color) + green "New Run" button. Stats appear as placeholders when session has no GPS data — expected behavior but UX concern for zero-data sessions.
- HikingScreen tracking bar: green 3px left-border accent, 4 fields (km/elapsed/elev/Stop button), GPS status pill top-left confirms connection quality. Flag FAB bottom-right with red badge count. Tracking bar has white background + Shadow.elevated — clearly elevated above map.
- MapHistory expanded state: checkmark replaces chevron on selected card, capsule stat row (km/time/elev/flags) with colored left borders appears below card, green solid "View on Map" pill CTA. Map placeholder does NOT update on selection (pre-existing behavior).
- MapHistory session cards: secondary line now shows "No GPS" instead of "-- km" for sessions without GPS distance — clarity improvement.
- FriendsScreen: 3-tier status dots confirmed working (green=online, amber=recently active ~45m, grey=inactive 3h+). Sharing toggles functional. MOCK_FRIENDS now includes Alex (amber state) for amber dot coverage.
- Warning triangle icon (red circle with exclamation) on map placeholders across MapHistory and HikingScreen — no label, purpose unclear to new users. Pre-existing.

## Sprint 26 Knowledge Updates
- FlagPlantSheet bottom-sheet pattern is significantly more intuitive than the previous dark AR overlay. 4-card layout makes all flag types immediately scannable. Disabled→active Save button progressive disclosure guides user naturally. Green border + CircleCheck selection indicator is unmistakable.
- Settings gradient icon badges + h3 mode titles create premium visual hierarchy. "Tap Save to apply" hint pill with ArrowUp icon explicitly communicates manual save (preventing auto-save confusion). Unsaved state resets correctly on navigation-away — no data loss.
- Toast feedback pattern ("Flag saved" with CircleCheck) + FAB badge increment = tight confirmation loop.
- Create Account form upfront Explorer mode disclosure ("You'll start in Explorer mode") reduces first-run confusion.
- "No GPS" label in MapHistory is definitively more informative than "--". Users immediately understand why distance data is missing.
- Navigation regression Sprint 26: flags persist across screen transitions, Settings state resets on unsaved exit. Zero new JS runtime errors from Sprint 26 changes.
- Medium friction: RotateCcw icon on "New Run" button (run complete screen) conventionally means "refresh/retry" not "start new". Label compensates but icon creates momentary cognitive mismatch. Consider PlusCircle or PlayCircle icon in future Sprint.
- Low friction: "No GPS | km" in MapHistoryScreen expanded capsule — bare "km" unit label without a number is visually noisy. Consider hiding distance chip entirely when GPS unavailable.

## Sprint 27 Knowledge Updates
- PlayCircle icon confirmed on RunningScreen New Run button — replaces RotateCcw. No cognitive mismatch.
- MapHistoryScreen "No GPS" sessions now show "No GPS" chip only — bare "km" unit successfully hidden when distance unavailable. Clean and clear.
- MapHistoryScreen auto-select working — first session expanded on load AND on re-mount after navigation away/back. Placeholder text "Select a route below to view" no longer appears when sessions exist.
- RoutesScreen premium uplift complete — gradient icon badges (sage green Mountain icon), shadow cards, stat chips with colored left-border, h1/800 title, consistent typography hierarchy. Matches Sprint 24+ design language.
- RoutesScreen was orphaned (not in navigator) — now wired: Home Tools section has "Routes" button (Route icon), BackButton pill added to RoutesScreen header, RootNavigator updated.
- HikingScreen layout corrected — Back button top-left, GPS pill top-right per iOS platform convention. All other screens already followed this pattern.
- Home Tools section now has 4 buttons: Map, Routes, Friends, Settings. Each has flex:1 so they shrink proportionally at 390px — no overflow.
- Navigation regression Sprint 27: zero new JS errors across all screen transitions. Only pre-existing Wake Lock errors from expo-keep-awake browser limitation.

## Sprint 28 Knowledge Updates
- Auth input focus state: focused field shows green border + green icon tint immediately on tap. Clear, unambiguous signal. Unfocused fields stay grey. Error state (red border) overrides focus state correctly.
- Settings section headers upgraded from 9px (FontSize.tiny) to 11px (FontSize.small) — now comfortably legible. Visual hierarchy: uppercase caps → card/toggle content. Previously flagged as too small, now resolved.
- Running route selection uses triple-signal system: colored left border + background tint + checkmark badge. Green for Free Run, blue for named routes. Switching routes gives instant, satisfying feedback. Selection state unambiguous even at a glance.
- Overlay surfaces (MapHistory stat bar, tab bar, HikingScreen GPS chip, track button) now use consistent 0.95 opacity white semi-transparent treatment. HikingScreen trackingBar uses Colors.surface (opaque) as it's an elevated card, not a floating overlay.
- Low friction: Auth form does not auto-focus email on screen entry — user must tap before green focus appears. Not a blocker.
- Low friction: Free Run (green) vs named route (blue) selection color distinction may briefly puzzle first-time users. Triple-signal system compensates — functionally unambiguous.

## Sprint 29 Knowledge Updates
- Sprint 29 established a consistent three-state interaction language app-wide: green border (#5d7c46) = focused/active, grey = unfocused, red (#c53d2e) = error/limit exceeded. Learnable and coherent. Auth forms, FlagPlantSheet, and Settings switches all follow this system.
- Auth Sign In auto-focus: email field now has green border immediately on screen mount — no tap required. Resolves previous Low friction item "user must tap before green focus appears." Net positive UX.
- Routes Download buttons: outlined pill (primary green border + text) below stat chips. Discoverable, clearly actionable. Download tap triggers Alert confirmation — user gets immediate feedback.
- FlagPlantSheet char counter: visible immediately on focus ("0/30"), turns red at 30/30 hard limit. Good progressive disclosure — sets expectations before typing. Improvement: a warning state at ~25/30 would give breathing room before hard cutoff.
- Settings switches: green fill = on, light grey (#E0E0E0) = off. Unambiguous visual distinction, zero learning curve.
- Navigation regression Sprint 29: 2 Wake Lock errors pre-existing (same as Sprint 28). Zero new JS errors introduced.

## Sprint 30 Knowledge Updates
- Sprint 30 introduced auto-focus on Create Account Name field — green border signals active input immediately on mount, consistent across re-navigation. Meaningful reduction in first-interaction friction.
- Character counter uses three-state color system: grey (safe) → amber at 25/30 → red at 30/30. Border also turns red at limit. Color escalation communicates urgency without requiring number-reading.
- Routes screen now displays human-readable dates ("12 May", "3 May", "28 Apr") instead of ISO strings. Zero cognitive load to parse.
- Settings dirty-state tracking is precise: hint pill appears only when unsaved changes exist, disappears on revert or save. Save button color (grey/green) reinforces the state. No false positives across multiple toggles.
- HomeScreen time-of-day greeting persists correctly across navigation and does not flicker. Personality mode (Navigator/Explorer) is reflected in the greeting subtitle alongside the time-of-day variant.
- Navigation regression Sprint 30: zero new console errors across all paths. Only pre-existing Wake Lock warnings (browser limitation, not app bug).
- Low friction (existing): Create Account Name field error on blur-without-input is slightly punitive for users exploring the form. Pre-existing onBlur validation behavior.
- Low friction (new): Char counter amber window is 5 characters (25-29). Adequate for a 30-char field but tight for fast typists.
