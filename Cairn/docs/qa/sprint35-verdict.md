# QA Verdict — Sprint 35

**Sprint**: 35
**Verdict**: PASS
**QA Subagent**: claude-opus-4-6 (a366c3df21280f6f3)
**Date**: 2026-05-16

## Per-Story Results

| Story | Verdict | Confidence | Notes |
|-------|---------|------------|-------|
| STORY-00117 | PASS | HIGH | All 8 ACs verified via Playwright screenshots at 390px |
| STORY-00118 | PASS | MEDIUM | All file artifacts confirmed; live service untestable (MySQL not installed — env constraint) |
| STORY-00119 | PASS | MEDIUM | Auth wiring confirmed; AC8/AC9 verified by code review only (requires backend+DB) |

## AC Details

### STORY-00117 — AuthScreen UI Polish
- AC1 ✅ Splash: Sign In (green/primary) first, Create Account (outlined/secondary) second — screenshots 1, 6
- AC2 ✅ Create Account: small cairn icon inline-left of title — screenshot 7
- AC3 ✅ Sign In: small cairn icon inline-left of title — screenshot 9
- AC4 ✅ Focus ring: green border, placeholder visible when unfocused; disappears when field filled (standard behavior)
- AC5 ✅ Privacy Policy: location data, account data, purpose, retention (3yr), user rights, NZ Privacy Act 2020, deletion rights — confirmed via source
- AC6 ✅ Continue with Apple on both forms — screenshots 3, 4
- AC7 ✅ Continue with Google on both forms — screenshots 3, 4
- AC8 ✅ All verified at 390px — screenshots 6, 7, 9

### STORY-00118 — Backend Scaffold
- AC1 ✅ All required files present: package.json, src/index.js, src/routes/auth.js, src/middleware/authenticate.js, src/models/User.js, src/config/db.js, .env.example
- AC2 ✅ /health returns {status, service, version, db, timestamp} — additive over spec, non-breaking
- AC3 ✅ register: bcrypt rounds=12, returns {token, user:{id,name,email}}
- AC4 ✅ login: returns {token, user} or 401
- AC5 ✅ JWT 7-day expiry, signed with JWT_SECRET env var
- AC6 ✅ Passwords stripped via toPublic()
- AC7 ✅ Duplicate email → 409 {error: 'Email already registered'}
- AC8 ✅ src/migrations/001_init.sql: users table with BIGINT UNSIGNED PK, name, email UNIQUE, password_hash, timestamps
- AC9 ✅ GET /api/auth/me with Bearer token middleware
- AC10 ✅ CORS configured for localhost:8082, 19006, exp://
- AC11 ✅ src/migrations/ directory with CREATE TABLE

### STORY-00119 — Frontend Auth Wired to Backend
- AC1 ✅ authService.ts exists with register/login/logout/getMe
- AC2 ✅ register success: saveToken + setUser + isLoggedIn:true
- AC3 ✅ login success: same as register
- AC4 ✅ Error shown inline: screenshot 12 shows "Cannot reach server. Check your connection." banner
- AC5 ✅ Loading state wired in code; connection refused returns instantly (no visual spinner opportunity)
- AC6 ✅ useAppStore.ts: user: UserProfile|null + setUser() confirmed
- AC7 ✅ api.ts: API_BASE_URL from env or localhost:3001 default
- AC8 ✅ hydrate() calls getMe() on launch — code confirmed (MEDIUM confidence, untestable without backend)
- AC9 ✅ SettingsScreen: logout() + setUser(null) + nav.replace('Auth') — code confirmed (MEDIUM confidence)

## Navigation Regression

| Path | JS Errors |
|------|-----------|
| Splash → Sign In → Back | 0 |
| Splash → Create Account → Back | 0 |
| Total console errors | 1 (ERR_CONNECTION_REFUSED to localhost:3001 — expected) |

## Untested Paths

- Live register/login happy path with real backend+MySQL
- AC8 live: app launch with valid JWT skipping AuthScreen
- AC9 live: Sign Out from active session
- Backend validation error messages (short password, invalid email)
- Token expiry (7-day)
- Rate limiting under load

## Bugs Filed

None.

## Evidence

All screenshots in `docs/qa/sprint35-evidence/`:
- STORY-00117-01 through STORY-00117-10 (splash, create-account, sign-in, privacy, 390px variants, nav regression)
- STORY-00119-10 through STORY-00119-12 (privacy validation, loading state, error banner)

## Knowledge Updates

- Backend requires MySQL for full integration; Sprint 35 operates in graceful degradation mode
- Privacy Policy is inline expandable section on Create Account form
- Apple/Google auth present as placeholder; full OAuth deferred
- Inline error banner pattern confirmed working for network failures
- Navigation regression clean across all auth screens
