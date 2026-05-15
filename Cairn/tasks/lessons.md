# Lessons Learned

## Sprint 21 — 2026-05-15
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
