# CR.md — Cairn

*Change Requests are appended here by PO. Where CR conflicts with PRD, CR takes precedence.*

---

## CR-001: UI Quality Uplift (Sprint 6)

User directive (post Sprint 5 review): UI framework direction is correct but quality is too low / too simple. Each page needs to be redesigned with higher design quality and UX. Approach: 1–3 sprints per page, finish one page before moving to next. Emoji icons must be replaced with SVG icon system. Animations and interactive feedback required on all elements.

**Status**: Approved — Sprint 6 begins execution

---

## CR-002: 防息屏 — Keep Screen Awake (Sprint 7)

Add `expo-keep-awake` to prevent screen sleeping during active running and hiking tracking states. Keep-awake activates only when `trackingState === 'tracking'` (hiking) or `runState === 'running'` (running). Automatically deactivates when activity ends.

**Status**: Approved — Sprint 7 execution target

---

## CR-003: Real Functionality — Enable Live Features (Sprint 7+)

Replace all mock data and static UI with real functionality: expo-location GPS tracking, real distance/pace calculation, flag planting writes to Zustand store, settings persistence via AsyncStorage. Implement page-by-page alongside UI quality uplift.

**Status**: Approved — Sprint 7+ execution target
