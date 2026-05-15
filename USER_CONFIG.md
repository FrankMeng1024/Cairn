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
- **Database host**: `122.51.174.118:3306` (MySQL 8)
- **Database user**: `frankdev` — 已授予全局最高权限 (WITH GRANT OPTION)，可建库、建用户
- **Database password**: 在 `.env` 中，不在此文件记录
- **Root password**: 与 frankdev 相同（已验证）
- **DevOps note**: 所有新项目直接用 frankdev 连 122.51.174.118，无需额外授权

---

## External APIs

- **GLM API**: model `glm-4-plus` — key stored in `.env` as `GLM_API_KEY`, never hardcoded or printed
- **Do not ask the user for GLM credentials again** — they are already configured

---

## Web Search (Enterprise Network Workaround)

- **Built-in WebSearch and WebFetch are BLOCKED** by enterprise network — do NOT attempt to use them
- **Use GLM search-pro instead**: `python C:/ClaudeCodeProjects/scripts/glm_websearch.py --mode tools "query"`
- **Batch mode**: `python C:/ClaudeCodeProjects/scripts/glm_websearch.py --batch queries.txt --output results.json --mode tools`
- **Models available**: `search-pro` (best quality, 智谱自研), `search-std` (搜狗/夸克)
- **No limit on queries** — search as deeply as needed, quality over saving credits
- **All /project workflow roles** (PO, Arch, Dev, QA) MUST use this script instead of WebSearch/WebFetch when they need internet data
- **Skill shortcut**: `/websearch "query"` invokes this automatically

---

## WeChat Developer Tools

- **安装路径**: `C:\tools\微信web开发者工具`
- **CLI bat**: `C:\tools\微信web开发者工具\cli.bat`
- 所有微信小游戏/小程序项目的 `TECH_SPEC.md §devtools-path` 默认使用此路径

---

## Communication Preferences

- **Reply language**: 中文
- **No decorative emoji** at end of messages or in file content unless explicitly requested
- **Terse responses**: lead with the answer or action, skip preamble
