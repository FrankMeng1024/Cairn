# User Configuration — Project Defaults

This file contains the user's fixed preferences and environment defaults.
It is binding for all projects under `C:\ClaudeCodeProjects\`.
Project-level specs (TECH_SPEC.md, DISCOVERY.md) may override these with explicit rationale documented in the project.

---

## Visual Quality Baseline

- **Minimum bar**: Production-quality UI — clean layout, consistent spacing, professional typography, all interactive states handled (hover, active, disabled, focus). This is the floor, not the target.
- **Arch obligation**: Before Sprint 0 style demos, review `docs/BENCHMARK.md` if it exists for project-specific bar. Otherwise use the minimum bar above.
- **Frontend obligation**: Every Story's UI output must meet this bar before marking Done.

---

## Target Platforms (default for all web/app projects)

- **Primary**: Mobile browser (375px viewport, touch-friendly interactions)
- **Secondary**: Desktop browser (1280px+, no scrolling required to see primary content)
- **Deploy target**: User's own server, accessible via web browser on both desktop and mobile
- **Override**: Projects may define different viewports in `TECH_SPEC.md §viewports` with explicit rationale.

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
