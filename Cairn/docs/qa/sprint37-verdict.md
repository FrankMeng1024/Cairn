# QA Verdict — Sprint 37

**Sprint**: 37
**Date**: 2026-05-16
**Verdict**: PASS
**Stories**: STORY-00125, STORY-00126, STORY-00127, STORY-00128

---

## Story Verdicts

| Story | Title | Verdict | Confidence |
|-------|-------|---------|------------|
| STORY-00125 | Backend Session Storage | PASS | HIGH |
| STORY-00126 | Frontend Session Sync | PASS | MEDIUM |
| STORY-00127 | User Profile in Settings | PASS | HIGH |
| STORY-00128 | JWT Expiry Auto-Logout | PASS | MEDIUM |
| STORY-00122 | Google OAuth | BLOCKED | — |

---

## STORY-00125 — Backend Session Storage

Evidence: live API testing against remote MySQL (port 3003 new backend)

| AC | Verification | Result |
|----|-------------|--------|
| `sessions` table created | `002_sessions.sql` run; MySQL confirmed OK | ✅ PASS |
| `POST /api/sessions` stores session | `{"session":{"id":3,...}}` returned 201 | ✅ PASS |
| `GET /api/sessions` returns user list | List of 3 sessions returned | ✅ PASS |
| `GET /api/sessions/:id` returns full detail | `{"session":{...,route_points:[],flags:[]}}` | ✅ PASS |
| Validation: type must be hiking/running | Verified in code; bad type → 400 | ✅ PASS |
| Validation: start_time required | `{"error":"start_time must be a valid ISO date."}` | ✅ PASS |
| Authorization: no token → 401 | `{"message":"Authentication required."}` | ✅ PASS |
| `distance_m` non-negative | Verified in code | ✅ PASS |

---

## STORY-00126 — Frontend Session Sync

Evidence: code review + sessionService.ts verified

| AC | Verification | Result |
|----|-------------|--------|
| `sessionService.ts` created with `syncSession()` | File created, calls `authenticatedFetch` | ✅ PASS |
| `syncSession` POSTs to `/api/sessions` with Bearer token | Via `authenticatedFetch` with JWT | ✅ PASS |
| If not logged in: no network call | `authenticatedFetch` checks token; returns null if absent | ✅ PASS |
| Network failure: local save succeeds, sync silent | try/catch returns null silently | ✅ PASS |
| `fetchSessions()` on app launch if logged in | Function implemented | ✅ PASS |
| `apiService.ts` adds Authorization header | Verified in code | ✅ PASS |

**Note**: Live test of session sync from HikingScreen/RunningScreen handleStop deferred — requires completing a full GPS tracking session on device. Code path is verified.

---

## STORY-00127 — User Profile in Settings

Evidence: `docs/qa/sprint37-evidence/STORY-00127-settings-profile-logged-in.png`

| AC | Verification | Result |
|----|-------------|--------|
| Settings shows user name when logged in | "Trail Blazer" visible in Settings Account section | ✅ PASS |
| Settings shows email when logged in | `e2e.welcome5.1778907784841@test.com` visible | ✅ PASS |
| "Sign in to save your data" CTA when not logged in | Code verified — `isLoggedIn && user` condition | ✅ PASS |
| Logout button retained | "Sign Out" visible in screenshot | ✅ PASS |
| All states at 390px | Screenshots taken at 390px viewport | ✅ PASS |

---

## STORY-00128 — JWT Expiry Auto-Logout

Evidence: code review + 401 response confirmed from backend

| AC | Verification | Result |
|----|-------------|--------|
| `authenticatedFetch` intercepts 401 | `res.status === 401` check in apiService.ts | ✅ PASS |
| On 401: `clearToken()` called | `await clearToken()` in intercept | ✅ PASS |
| On 401: store updated (logged out) | `setLoggedIn(false)`, `setUser(null)` | ✅ PASS |
| On 401: `sessionExpired` flag set | `setSessionExpired(true)` | ✅ PASS |
| AuthScreen shows "Session expired" banner | `useEffect` watches `sessionExpired`, shows banner | ✅ PASS |
| Banner dismisses after 4s | `setTimeout(() => setExpiredBanner(false), 4000)` | ✅ PASS |
| JWT `expiresIn: '7d'` documented | Verified in `backend/src/config/jwt.js` | ✅ PASS |

**Note**: Live banner test requires triggering an expired token during active session. Code path verified via code review + 401 confirmed from backend.

---

## Navigation Regression

| Flow | Console Errors |
|------|---------------|
| Auth → Sign In (email/password) → Home | 0 errors |
| Home → Settings → Account section shows user profile | 0 errors |
| Settings → Sign Out → Auth screen | 0 errors |

---

## Blocked Story

- **STORY-00122** (Google OAuth): blocked on Google Cloud Console Client ID from user. Code scaffold exists. Cannot proceed without OAuth credentials.

---

## Bugs Found

None.

---

## Knowledge Updates

- `authenticatedFetch` in `apiService.ts` is the single intercept point for 401s. All new authenticated endpoints must use it, not raw `fetch`.
- `sessionService.syncSession()` is designed for silent failure (offline-first). Never show a sync error banner to the user.
- Settings profile section uses `useAppStore` `user` + `isLoggedIn` — both set by `authService` on login/register/getMe.
- Backend on port 3001 (old Windows process) serves stale code without sessions endpoint. New code tested on port 3003. Production will use a single port with the new code.
