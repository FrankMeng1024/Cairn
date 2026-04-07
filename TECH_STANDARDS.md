# Tech Stack & Project Structure Standards

## Tech Stack Selection

Performed by Arch in Sprint 0. Documented in `docs/TECH_SPEC.md`.

**No default stack.** Every project's stack is chosen based on its specific requirements.

### Decision Framework

| Question | Options | Deciding Factor |
|---|---|---|
| Backend language | Python, Go, Node.js, other | IO-bound → any async; CPU-bound AI/ML → Python required; developer velocity → Node.js |
| Backend framework | FastAPI, Express, Gin, Next.js API, others | Language + async needs + team familiarity |
| Database | MySQL/PostgreSQL, MongoDB, SQLite, others | Relational + transactions → SQL; flexible/nested docs → Mongo; local tool → SQLite |
| Frontend form | SPA, SSR, MPA, full-stack framework | SEO critical → SSR; complex state → SPA; simple tool → MPA |
| Frontend framework | Vanilla JS, React, Vue, Next.js | ≤ 5 pages → Vanilla; complex state → React/Vue; full-stack JS → Next.js |
| Deployment | Docker, serverless, bare metal | Docker is default; serverless if event-driven fits |
| AI/ML services | Local model, API service, hybrid | Audio → local Whisper; general LLM → API; evaluate cost vs latency per project |

### Non-negotiables
- Real database from day one — no SQLite in production
- JWT or session-based auth for any user-facing API — decided in Sprint 0
- Secrets in `.env`, never hardcoded
- `start.ps1` for local dev (Windows-first environment)
- Docker for production deployment (final Sprint only)

### Language-Specific References
For Python projects: see `C:\ClaudeCodeProjects\PYTHON_STANDARDS.md` for Python 3.14 compatibility table, httpcore patch procedure, pip mirror rules, and uvicorn configuration rules.

For other languages: create `docs/LANG_STANDARDS.md` in that project with equivalent notes on known compatibility issues for that language/runtime.

---

## Project Directory Structure

The directory structure adapts to the tech stack. The following is a reference for a Python/Vanilla JS project.

```
<project-name>/
├── backend/               # Server-side application
│   ├── <app-code>/
│   ├── static/            # Frontend (if served by backend)
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   ├── <dependency-file>
│   └── .env.example
├── scripts/
│   ├── fix_compat.py
│   └── validate_deps.py
├── docs/
│   ├── DISCOVERY.md
│   ├── PRD.md
│   ├── TECH_SPEC.md
│   ├── API_SPEC.md
│   ├── DB_SCHEMA.md
│   ├── UI_SPEC.md
│   ├── BACKLOG.md
│   ├── BENCHMARK.md
│   ├── style-demos/
│   └── spike-results/
├── tasks/
│   ├── jira/
│   └── lessons.md
├── tests/
│   ├── test_unit.py
│   └── test_functional.py
├── start.ps1
├── .gitignore
└── README.md
```

### .gitignore Minimum
```
.env
venv/
node_modules/
__pycache__/
*.pyc
logs/
storage/
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
*.log
```
