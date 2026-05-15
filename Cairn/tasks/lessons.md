# Lessons Learned

## Sprint 25 — 2026-05-15
- [archived: CLAUDE.md §Integration] Sprint 25: clean Sprint, no retrospective actions. Zero QA bugs (4/4 stories PASS, 3 HIGH + 1 MEDIUM), no integration restart loops, no Spec Drift, no prior VU NOT ACCEPTED.
- [resolved: Sprint 25] STORY-00065 amber status dot coverage gap — MOCK_FRIENDS now includes Alex (lastSeen: '45m ago', online: false). Amber dot confirmed rendering as Colors.warning.
- [resolved: Sprint 25] Session cards "-- km" — MapHistoryScreen now shows "No GPS" label. HomeScreen strip uses duration-only format (never shows "-- km"). Both resolved.
- [pending] UX: MapHistoryScreen placeholder persists when sessions visible — consider auto-selecting first route on load (Low, backlog). Pre-existing, deferred.
- [pending] Run Complete screen stats as zeros for mock/no-GPS sessions — UX concern for first-time users with genuine tracking failures. Low priority; data-dependent behavior is correct. Consider empty-state messaging.
- [pending] STORY-00062: distance > 10m km-display branch still untested (no session with distance > 100m in test data). Future QA sprint: seed a session with distance > 100m.
- [pending] STORY-00062: "Hike" badge variant still untested. Future QA: add hike session to store before test.
- [pending] UX: Explorer mode subtitle shows before user has established preference (backlog Low).
- [pending] UX: Lock hint in RunningScreen — verify icon rendering cross-platform (backlog Low).

## Sprint 24 — 2026-05-15
- [archived: CLAUDE.md §Integration] Sprint 24: clean Sprint, no retrospective actions. Zero QA bugs (4/4 stories PASS HIGH), no integration restart loops, no Spec Drift (orphaned routeName style = acceptable dead code, Arch confirmed), no prior VU NOT ACCEPTED.
- [resolved: Sprint 25] STORY-00065 amber status dot (Colors.warning, Recent <1h) — no test data friend with activity in 0-60min window. Future QA: add a friend with lastSeen='45m ago' to MOCK_FRIENDS test data.
- [resolved: Sprint 25] UX: Session cards "-- km" when no GPS distance — ambiguous for new users. Consider "No GPS" label or omitting field (Low, backlog).
- [pending] UX: MapHistoryScreen placeholder persists when sessions visible — consider auto-selecting first route on load (Low, backlog).


- [archived: CLAUDE.md §Integration] Sprint 23: clean Sprint, no retrospective actions. Zero QA bugs, no integration restart loops, Arch flagged one non-blocking Medium spec drift (topo opacity string manipulation — deferred to future cleanup). No prior VU NOT ACCEPTED.
- [pending] STORY-00062 AC2: distance > 10m km-display branch not tested in Sprint 23 (only duration fallback). Future QA should add a session with distance > 100m to test data.
- [pending] STORY-00062 AC1: "Hike" badge variant not tested (no Hike sessions in test data). Future QA should add hike session to store data.
- [resolved: Sprint 23] Spec drift: MODE_META Navigator used hardcoded '#b47c28' and 'rgba(180,130,60,0.12)' — now uses Colors.flag and Colors.flagLight (STORY-00061 DONE).

## Sprint 22 — 2026-05-15
- [archived: CLAUDE.md §Integration] Sprint 22: clean Sprint, no retrospective actions. Zero QA bugs, no integration restart loops, no Spec Drift confirmed fixed, no prior VU NOT ACCEPTED.
- [resolved: Sprint 22] "0.0 km" stat on HomeScreen — formatDistance now returns '--' for <10m (STORY-00056 DONE)
- [resolved: Sprint 22] "+0m elev · 0 flags" zero-value noise — secondary stats row hidden when both zero (STORY-00056 DONE)
- [resolved: Sprint 22] ✓ unicode in RunningScreen checkBadge — replaced with lucide Check icon (STORY-00057 DONE)
- [resolved: Sprint 22] FriendsScreen Switch thumbColor was conditional — now always '#fff' (STORY-00057 DONE)
- [pending] UX: Explorer mode subtitle shows before user has established preference (backlog Low priority)
- [pending] UX: Lock hint in RunningScreen — verify icon rendering cross-platform (backlog Low priority)


- [archived: CLAUDE.md §Integration] Sprint 21: clean Sprint, no retrospective actions. Zero QA bugs, no integration restart loops, no Spec Drift, no prior VU NOT ACCEPTED.
- [pending] UX: "0.0 km" stat showing on HomeScreen when user has 1 session — zero-value display needs investigation (test data artifact or real bug). Filed in Sprint 22 backlog.
- [pending] UX: Explorer mode subtitle ("Explorer · 1 session") shows before user has established a preference — consider showing mode only after N sessions. Backlog Low.
- [pending] UX: Lock hint in RunningScreen shows emoji lock (🔒) in some environments instead of lucide Lock icon — verify icon rendering cross-platform.
- [resolved: Sprint 21] Auth privacy checkbox UX — checkbox and Privacy Policy link now separate TouchableOpacity targets (STORY-00051 DONE)
- [resolved: Sprint 21] FAB badge showing "1" when 0 markers — badge hidden at count=0 (STORY-00054 DONE)

## Sprint 20 — 2026-05-15
- [archived: CLAUDE.md §Integration] Sprint 20: clean Sprint, no retrospective actions. Zero QA bugs, no integration restart loops, no Spec Drift, no VU NOT ACCEPTED.
- [resolved: Sprint 21] UX: FAB badge count on Hiking screen lacks label context — fixed with badge hidden at 0 count.
- [resolved: Sprint 21] Auth flow: Privacy Policy checkbox requires coordinate-clicking the left side of the row — fixed with separate TouchableOpacity.
- [pending] UX: "+0m elev · 0 flags" shows zero-value noise on run sessions — consider hiding zero-value secondary stats when both are zero.
