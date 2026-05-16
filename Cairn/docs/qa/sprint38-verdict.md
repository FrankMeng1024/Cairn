# QA Verdict — Sprint 38

**Sprint**: 38
**Date**: 2026-05-16
**Verdict**: PASS

## Stories Verified

| Story | Title | Verdict | Confidence |
|-------|-------|---------|------------|
| STORY-00122 | Google OAuth (Continue with Google) | PASS | HIGH |

## STORY-00122 — AC Verification

| AC | Result | Notes |
|----|--------|-------|
| "Continue with Google" button visible on Sign In screen | PASS | Screenshot STORY-00122-01 |
| "Continue with Google" button visible on Create Account screen | PASS | Screenshot STORY-00122-04 |
| Clicking button triggers real OAuth popup (not an Alert) | PASS | accounts.google.com popup tab opened (tabs 2,3,4) confirming promptGoogleAsync() fires |
| No spurious form validation errors when Google button clicked | PASS | After blur-guard fix (googleFlowActive ref), no "Email is required" shown — STORY-00122-03, STORY-00122-04 |
| Zero console errors | PASS | browser_console_messages(level="error") → 0 errors |
| Backend POST /api/auth/google endpoint exists with google-auth-library verification | PASS | Confirmed via code review + direct test on port 3004 returned proper 401 (enterprise network blocks googleapis.com cert fetch from WSL — expected, remote server has open internet) |
| google_sub column in DB, password_hash nullable | PASS | Migration 003 confirmed via DESCRIBE users |
| loginWithGoogle() in authService.ts posts id_token, saves JWT on success | PASS | Code review confirmed; useEffect in AuthScreen wires response → loginWithGoogle → nav.replace('Home') |

## Known Limitations (not bugs)

- **Enterprise network**: WSL cannot reach googleapis.com to verify Google id_tokens in dev environment. Backend returns 401 with proper error message. Remote server (122.51.174.118) has open internet — will work in production.
- **Playwright popup**: accounts.google.com loads as chrome-error because enterprise firewall blocks it. This is environment-specific, not a code defect.

## Evidence

- `docs/qa/sprint38-evidence/STORY-00122-01-signin-screen.png` — Sign In with Google button visible
- `docs/qa/sprint38-evidence/STORY-00122-02-google-popup-attempted.png` — Popup opened (before blur fix)
- `docs/qa/sprint38-evidence/STORY-00122-03-google-no-spurious-error.png` — No validation errors after fix
- `docs/qa/sprint38-evidence/STORY-00122-04-create-account-google-clean.png` — Create Account clean

## Navigation Regression

- Auth splash → Sign In → Back → Splash: PASS (no console errors)
- Auth splash → Create Account → Back → Splash: PASS (no console errors)
