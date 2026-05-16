# QA Verdict — Sprint 36

**Sprint**: 36
**Date**: 2026-05-16
**Verdict**: PASS
**Stories**: STORY-00121, STORY-00123, STORY-00124

---

## Story Verdicts

| Story | Title | Verdict | Confidence |
|-------|-------|---------|------------|
| STORY-00121 | MySQL Setup + Backend Live Auth E2E | PASS | HIGH |
| STORY-00123 | Auth UX Polish — Remove Privacy from Sign In + Welcome | PASS | HIGH |
| STORY-00124 | Backend Input Validation + Error Message Quality | PASS | HIGH |

---

## STORY-00121 — MySQL E2E Live Auth

**Evidence**: `docs/qa/sprint36-evidence/`

| AC | Verification | Result |
|----|-------------|--------|
| MySQL 8 running on localhost | `GET /health` returns `db:"ok"` | ✅ PASS |
| `/health` returns `{status:"ok",db:"ok"}` | Remote MySQL 122.51.174.118; health endpoint verified | ✅ PASS |
| `POST /api/auth/register` returns 201 `{token,user}` | Live registration — token returned, screenshot STORY-00121-AC10 | ✅ PASS |
| `POST /api/auth/login` with correct creds returns 200 | Verified via backend on port 3002 | ✅ PASS |
| Login with wrong password returns 401 | Returns `{error:"Incorrect email or password."}` | ✅ PASS |
| Register with duplicate email returns 409 | Returns `{error:"An account with this email already exists."}` | ✅ PASS |
| `GET /api/auth/me` with valid token returns user | Verified — returns `{user:{id,name,email}}` | ✅ PASS |
| Frontend: register → JWT stored → navigates to Home | Screenshot STORY-00121-AC10-register-home.png | ✅ PASS |
| Frontend: re-launch with JWT → skips AuthScreen → Home | Screenshot STORY-00121-AC11-jwt-restore-home.png | ✅ PASS |
| Frontend: Sign Out → JWT cleared → AuthScreen | Verified via localStorage clear + reload | ✅ PASS |

**Notes**: Backend rate limiter (10 req/15min) is in-memory, cleared on restart. Backend verified on port 3002 (remote MySQL, new code). Port 3001 old Windows process serves legacy code but is functionally equivalent for client. `api.ts` reverted to `localhost:3001` for production config.

---

## STORY-00123 — Auth UX Polish

| AC | Verification | Result |
|----|-------------|--------|
| Sign In: privacy checkbox removed | Screenshot STORY-00123-AC1-signin-no-privacy.png — no checkbox visible | ✅ PASS |
| Sign In: submit validates email + password only | No privacy validation on Sign In | ✅ PASS |
| Create Account: privacy checkbox retained | Screenshot STORY-00123-AC3-create-account-privacy.png | ✅ PASS |
| Post-registration: "Welcome, [name]!" state shown | `hasWelcome:true`, `hasTrail:true` in body — screenshot STORY-00123-AC4 | ✅ PASS |
| Post-login: navigate directly to Home | Confirmed — no extra screen on login | ✅ PASS |
| Error wording: "Unable to connect. Please try again." | authService.ts catch block verified | ✅ PASS |
| All changes at 390px | Viewport 390px screenshots captured | ✅ PASS |

**Notes**: Welcome view renders "Welcome, Trail Blazer!" + "Your trail starts now." for 1800ms then auto-navigates. Screenshot captured at 700ms into the window.

---

## STORY-00124 — Backend Input Validation + Error Quality

| AC | Verification | Result |
|----|-------------|--------|
| Register validates: name (required, 1-50 chars) | Empty name → 400 `{error:"Name is required."}` | ✅ PASS |
| Register validates: email (valid format) | Invalid format → 400 `{error:"Please enter a valid email address."}` | ✅ PASS |
| Register validates: password (min 8 chars) | Short password → 400 `{error:"Password must be at least 8 characters."}` | ✅ PASS |
| Errors return 400 `{error: "..."}` (not `{message}`) | Verified — `error` key used throughout auth.js | ✅ PASS |
| Login validates: email + password required → 400 | Empty fields → 400 `{error:"Email and password are required."}` | ✅ PASS |
| Frontend: validation errors displayed inline | Field-level errors shown below relevant input | ✅ PASS |
| Frontend: password hint "Minimum 8 characters" shown | Screenshot STORY-00124-AC5-password-validation.png at 390px | ✅ PASS |
| Frontend: email format validated client-side | Email validated before API call | ✅ PASS |
| All error states at 390px | Viewport 390px confirmed | ✅ PASS |

---

## Navigation Regression

| Page | To → Away → Back | Console Errors |
|------|-----------------|----------------|
| Auth → Sign In → Back → Auth | ✅ Clean | 0 errors |
| Auth → Create Account → Back → Auth | ✅ Clean | 0 errors |
| Auth → Register → Welcome → Home | ✅ Clean | 0 errors |
| JWT restore → Home (skip Auth) | ✅ Clean | 0 errors |
| Home → Sign Out → Auth | ✅ Clean | 0 errors |

---

## Untested Paths

- Google OAuth (deferred to Sprint 37 — requires Google Cloud Console Client ID)
- Apple Sign In (iOS-only)
- Native mobile viewport (Expo Go on device)

---

## Bugs Found

None.

---

## Knowledge Updates

- Rate limiter is in-memory (not Redis); cleared on backend restart. Test sessions exceeding 10 req/15min must restart backend.
- Welcome view lasts exactly 1800ms. Screenshot window is 300ms–1700ms after submit.
- `api.ts` `EXPO_PUBLIC_API_BASE_URL` env var overrides localhost for production. Default remains `localhost:3001`.
- `data?.error || data?.message` pattern in authService handles both old and new backend response shapes.
