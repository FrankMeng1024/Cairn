# User Configuration — Project Defaults

This file contains the user's fixed preferences and environment defaults.
It is binding for all projects under `C:\ClaudeCodeProjects\`.
Project-level specs (TECH_SPEC.md, DISCOVERY.md) may override these with explicit rationale documented in the project.

---

## Visual Quality Baseline

- **Reference project**: FrankProject (`C:\ClaudeCodeProjects\FrankProject`)
- **Minimum bar**: Match or exceed FrankProject's visual quality on every Sprint — this is the floor, not the target
- **Arch obligation**: Before proposing Sprint 0 style demos, Arch reviews FrankProject to calibrate the quality bar
- **Frontend obligation**: Every Story's UI output is compared against FrankProject before marking Done — if it falls below that bar, it is not Done

---

## Target Platforms (default for all web/app projects)

- **Primary**: Mobile browser (375px viewport, touch-friendly interactions)
- **Secondary**: Desktop browser (1280px+, no scrolling required to see primary content)
- **Deploy target**: User's own server, accessible via web browser on both desktop and mobile
- **Exception**: Projects that are explicitly desktop-only tools (CLI, game, etc.) document their target platform in TECH_SPEC.md and this mobile default does not apply

---

## Infrastructure Defaults

- **Database**: Real database from day one — no SQLite for production features, no in-memory substitutes in functional tests
- **Auth**: JWT-based user authentication unless the project explicitly has no user identity requirement (documented in DISCOVERY.md "What We Will NOT Build")
- **Secrets**: All credentials in `.env`, never hardcoded, `.env.example` always provided

---

## Server & Database

- **Server**: User's own server (connection details in `.env` — never commit credentials)
- **Database host**: User's own database server (connection details in `.env`)
- **DevOps note**: `start.ps1` must support both local dev and pointing to user's remote server via env vars

---

## External APIs

- **GLM API**: model `glm-4-plus` — key stored in `.env` as `GLM_API_KEY`, never hardcoded or printed
- **Do not ask the user for GLM credentials again** — they are already configured

---

## Communication Preferences

- **Reply language**: 中文
- **No decorative emoji** at end of messages or in file content unless explicitly requested
- **Terse responses**: lead with the answer or action, skip preamble
