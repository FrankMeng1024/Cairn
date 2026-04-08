# Project Factory — Agile Workflow (UI Projects)

This is the master instruction file for all UI projects under `C:\ClaudeCodeProjects`.
Every project MUST follow this workflow. Every agent MUST read and internalize this file before taking any action.

**User defaults**: `C:\ClaudeCodeProjects\USER_CONFIG.md` — binding for all projects unless DISCOVERY.md overrides with documented rationale. Read before Sprint 0.

---

## Core Principles

1. **Agile Iterations**: Work in Sprints. Every Sprint ends with a real, runnable demo.
2. **Role Authority**: Every role has explicit authority. Where roles coordinate, the handoff protocol is defined in this file. Unauthorized overlap = failure.
3. **Real Verification Only**: No mock-based "it works". Every verification must run against the real, running product. Screenshots of the running UI are the primary evidence — text-only claims are not acceptable.
4. **Technology Is a Decision, Not a Default**: Stack is chosen per project. No default stack.
5. **Document-Driven**: No coding without specs. Specs change → update spec first, then code.
6. **Quality Over Quantity**: One small feature done to production quality beats five done poorly.
7. **No Laziness**: Find root causes, not workarounds. Senior Developer standard.
8. **Fail Fast**: Problems surface at Sprint boundaries, not at final delivery.
9. **User Minimal Interruption**: User participates only at defined escalation points. All other decisions resolved autonomously.
10. **Platform-Appropriate Quality**: Every feature must work on all target viewports defined in DISCOVERY.md. Viewports are project-specific — defined at Sprint 0, not assumed.
11. **PO Is the Last Gate, Not the Only Gate**: QA self-verifies everything before PO ever sees it.
12. **Spike Before Build**: Any new system-level dependency must be proven in a Spike before a production Story depends on it.
13. **Complete Evidence Over Existence Proof**: A screenshot or HTTP 200 is not completion proof. Every verification role (UX, QA) must complete the full user action loop — entry → interaction → observable result — for every feature, every Sprint. Waiting time, feedback clarity, and state transitions are first-class verification targets.

---

## Project Scope

This workflow is for **Full-Stack UI projects**. All live verification uses MCP Playwright (interaction + screenshots) and MCP Chrome DevTools (measurement + error inspection).

**Playwright availability rule**: MCP Playwright is **mandatory** for all UI project verification. At the start of every Sprint (after `/model opus`), verify Playwright MCP is available by checking `/mcp` or attempting a Playwright tool call. **If Playwright MCP is NOT available: STOP immediately and notify the user.** Do NOT fall back to curl/bash. Do NOT continue the Sprint. Playwright is the only tool that can catch frontend runtime errors (JS crashes, rendering failures, interaction bugs) — curl fallback has been proven to miss Blocker-level bugs that ship to the user. The user must fix the MCP configuration before work continues.

## Resuming After Context Compact

When a conversation is compacted and resumed mid-project (e.g., `/project --auto 继续开发`):

**If all critical docs exist** (`docs/PRD.md`, `docs/TECH_SPEC.md`, `docs/DISCOVERY.md`, `tasks/jira/` with Sprint directories) — skip "Joining an Existing Project" entirely. Instead:
1. Read `tasks/PROJECT_STATE.md` if it exists — get current Sprint number and open tasks
2. Run `git log --oneline -5` — see what was recently committed
3. Check `tasks/jira/` for the current Sprint directory — find in-progress Stories and open bugs
4. Continue from exactly where the work left off — no alignment checks, no document re-reads, no user confirmation needed

**If a critical doc is missing** — follow "Joining an Existing Project" below.

---

## Acceptance Modes

Determined at Sprint 0, recorded in `docs/TECH_SPEC.md §acceptance`. Cannot change mid-project without CR.

**Mode 1 — User verifies each Sprint** (default, `acceptance_mode: manual`):
- PO runs the Sprint Demo, exercises each Story against the running product
- User (PO) is the final acceptance gate
- Virtual User role is **skipped entirely**

**Mode 2 — Autonomous iteration** (`acceptance_mode: auto`):
- Activated when the `/project` skill is invoked with `--auto`
- **Sprint 0 runs normally with the user** — requirements discussion, style selection (CP1), and plan confirmation (CP2) all happen as usual. The user defines what gets built.
- **From Sprint 1 onward**: all roles are played by the main agent. No user confirmation at Sprint boundaries.
- Virtual User is **mandatory** — it cannot be skipped
- Virtual User is the **project-completion acceptance gate** — it is triggered during Sprint Planning when the team unanimously determines there is nothing left to build, NOT at the end of every Sprint
- **PO is the main agent from Sprint 1**: after each Sprint, PO opens Sprint Planning for the next Sprint. If during Planning (Step 0 — Backlog Refinement), **all key roles (PO, Arch, SM, PM, Dreamer if active) unanimously confirm there is no content worth opening a new Sprint for** — all Must-Have Done, no actionable bugs, no pending CRs, no proposals — then PO triggers VU acceptance instead of opening a new Sprint
- PO reviews Virtual User acceptance reports; if NOT ACCEPTED, SM opens a new Sprint — no user input required
- QA and UX still run every Sprint as normal — Virtual User runs only when the team reaches consensus at Sprint Planning that there is nothing left to build
- **User escalation from Sprint 1 onward** occurs ONLY in the three conditions listed in the User Escalation Conditions table (Mode 2 column)

All role definitions, Sprint lifecycle steps, and completion criteria reference these modes by name. See **Virtual User** role for Mode 2 details. See **Project Completion** for per-mode checklists.

---

## Model Assignment

**This is the single source of truth for model selection.** All subagent launches, role assignments, and fallback decisions reference this table — never hardcode a model elsewhere.

| Context | Required Model |
|---|---|
| Sprint Planning (SM, Arch) | `claude-opus-4-6` |
| Arch Code Review | `claude-opus-4-6` |
| UX Live Review | `claude-opus-4-6` |
| QA Lead Smoke Test | `claude-opus-4-6` |
| QA Subagent | `claude-opus-4-6` |
| PO Acceptance Demo | `claude-opus-4-6` |
| Sprint Retrospective | `claude-opus-4-6` |
| Spike Review | `claude-opus-4-6` |
| Virtual User Subagent | `claude-opus-4-6` |
| Frontend Dev self-verify | `claude-sonnet-4-6` minimum |
| All other development work | `claude-opus-4-6` preferred, `claude-sonnet-4-6` acceptable |

**Rules**:
- **Always use Opus first.** Haiku is never acceptable for any task in this workflow.
- **Fallback**: If Opus is unavailable, switch to Sonnet. Never fall below Sonnet. Log the fallback in `tasks/lessons.md`.
- **Model enforcement**: At the start of every Sprint, run `/model opus`. Do NOT ask the user to switch — do it yourself.
- **Subagent launches**: Every subagent launch call MUST include an explicit `model` parameter per this table. Never rely on model inheritance.

---

## Role Tool Permissions

Declared per-role. Main agent enforces these as hard constraints — not suggestions.

| Role | Permitted tools | Prohibited |
|------|----------------|------------|
| QA subagent | Read (knowledge.md + ACs only) | Bash, Edit, Write, any source file Read |
| UX subagent | Read (knowledge.md only) | Bash, Edit, Write, any source file Read |
| Virtual User subagent | Read (PRD.md + CR.md only) | Bash, Edit, Write, any other file Read |
| Main agent (as hands) | All Playwright + Bash + Read/Write for evidence and verdict/review files | Cannot compose verdict/review/acceptance independently — must write from subagent's structured output |
| Developers | All tools | Cannot write verdict/review/acceptance — subagent output only |

**Enforcement**: Subagents return structured JSON output; main agent physically writes the verdict/review/acceptance file from that output. Subagents have no Write tool access. Main agent writes the file but does NOT compose its content — content comes from subagent structured output only. When launching a subagent, main agent provides ONLY the files in the "Permitted tools" column as context.

---

## MCP Tool Protocol

| Tool | Purpose |
|---|---|
| **MCP Playwright** | Interaction + screenshots: `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_take_screenshot`, `browser_resize`, `browser_console_messages`, `browser_select` |
| **MCP Chrome DevTools** | Measurement + inspection: `list_network_requests`, `list_console_messages`, `performance_start_trace`, `lighthouse_audit`, `take_snapshot` |

Use Playwright for interaction and visual verification. Use Chrome DevTools for measurement and error inspection. Use both where both add value.

**Evidence directories** (canonical definition — all roles reference this section):

```
docs/qa/
  sprintN-evidence/         ← QA screenshots, JSON responses, timing logs
docs/ux/
  sprintN-evidence/         ← UX screenshots
docs/virtual-user/          ← Only in Mode 2
  sprintN-flow/             ← Sequential screenshots (flipbook)
```

**Evidence naming convention**: `<story-id>-<step>.png` (e.g. `STORY-00012-03.png`).
All roles saving evidence use this convention and these directories.

---

## Role Definitions

Thirteen roles. Each has exactly one area of authority. Virtual User is conditional (Mode 2 only — see Acceptance Modes). Dreamer is optional.

### PO (Product Owner)

**Authority**: Business requirements and final acceptance.

**Mode 1** — PO is the user. Participates at every Sprint Demo.
**Mode 2** — PO is the main agent. User does not participate. Main agent plays PO autonomously.

**Responsibilities**:
- Produces the PRD and breaks it into Epics
- Confirms style direction / interface design at Sprint 0
- Mode 1: verifies every Sprint Demo — independently exercises each Story against the running product, takes evidence; opens Blocker/Critical bugs when demo fails
- Mode 2 (main agent as PO): after each Sprint, opens Sprint Planning for the next Sprint. At Planning Step 0, if all key roles (PO, Arch, SM, PM, Dreamer if active) unanimously confirm there is nothing worth opening a new Sprint for — triggers VU acceptance. Otherwise opens a new Sprint. Reviews VU acceptance reports and escalates disagreements to SM
- Proposes CRs based on evolving product thinking

**Does NOT**: write code, make tech decisions, manage agents.

---

### PM (Project Manager)

**Authority**: Sprint execution and agent health.

**Responsibilities**:
- Evaluates Story points and assigns Stories to agents for each Sprint
- **Story file annotation**: after SM creates Story files, PM opens the same file and adds points + assignee. PM transitions status to Todo.
- Monitors agent state; updates per-agent rule files and prompt contexts for correction and reward
- Manages Story and Bug metadata: transitions status (Todo → In Progress → Done/Blocked)
- Resets agent context when conversation quality degrades
- At Sprint Planning: verifies every Story has been sized, assigned, and has identified test data
- At Sprint Retrospective: updates per-agent rule files based on what worked and what failed

**Does NOT**: write code, make tech decisions, do acceptance, create/edit Story AC content (SM's job), modify CLAUDE.md (SM's job), add backlog items from any source other than PO-issued CRs.

---

### Arch (Architect)

**Authority**: All technical decisions. Final say on tech disputes. Code review gatekeeper.

**Responsibilities**:
- Leads tech stack selection at Sprint 0
- Designs and maintains the interface contract (`docs/API_SPEC.md` + `docs/UI_SPEC.md`)
- Produces 3 static HTML style demos at Sprint 0
- Breaks ties when developers disagree
- Identifies dependencies requiring a Spike
- **Trade-off logging**: at every Sprint Planning, explicitly state known trade-offs. SM logs these as backlog items.
- **Code Review** (at Integration step 3): reviews for logic errors, security issues, interface contract compliance. **Also confirms any Spec Drift fixes logged in Story Notes** (see Guardrails). Blocks subsequent steps until resolved.
- **Spot-check** during bug fix cycle: confirms fix does not introduce new issues or break contracts.

**Does NOT**: write business logic, manage business requirements.

---

### DBA (Database Administrator)

**Authority**: Database schema. Only role allowed to modify schema. **Skip entirely if project has no persistent data store** — document in DISCOVERY.md.

**Responsibilities**:
- Designs initial schema at Sprint 0 → `docs/DB_SCHEMA.md`
- Executes all schema changes (Backend requests via `tasks/schema_change_request.md` → DBA executes → DBA deletes the request file after execution)
- Produces `docs/db/schema_changes_sprintN.sql` at end of each Sprint

**Does NOT**: write business logic, touch frontend or backend application code.

---

### Scrum Master (SM)

**Authority**: Sprint process, inter-agent communication, Jira file ownership, and CLAUDE.md maintenance.

**Responsibilities**:
- Facilitates Sprint Planning Meeting and Sprint Retrospective
- **Creates all Jira Story and Bug files** — SM writes the file with ACs. PM then annotates with points + assignee (see PM role).
- **Demo bug files**: when PO finds a bug during Demo, SM creates the Bug file in real time. PO describes the issue, SM writes it immediately. PM assigns owner after (or immediately if Blocker stops the demo).
- **AC operationalization rule**: every AC must be independently verifiable by a QA agent with no implementation knowledge. "Feels right", "looks good" are not acceptable. AC must cite a specific, verifiable condition.
- **Requirement traceability check**: at Sprint Planning Step 0, every feature in `docs/PRD.md` + `docs/CR.md` must map to a Story, the backlog, or the "What We Will NOT Build" section in DISCOVERY.md. Gaps escalated to PO.
- At Sprint Planning step 1: integrates UX ACs into Story files alongside functional ACs (equal weight)
- Broadcasts interface contract changes; routes schema change requests to DBA
- **CR tracking**: maintains CR scheduling and 2-Sprint window deadlines. At Sprint Planning Step 0, identifies CRs due for scheduling and surfaces to PO. At end of 2-Sprint window, SM escalates to PO: schedule or withdraw. If PO does not respond within 1 additional Sprint, SM withdraws the CR and notes it in `docs/CR.md` as Withdrawn.
- **Closes Bug files** after QA marks Verified (administrative act)
- Updates CLAUDE.md when workflow changes are warranted (see CLAUDE.md update rule in Sprint Retrospective)

**Does NOT**: make technical decisions, write code, do acceptance, estimate Story points (PM's job), modify per-agent rule files (PM's job), verify bug fixes (QA's job).

---

### Backend Dev

**Authority**: Server-side application code and application config files (not the start script — see Start Script Lifecycle).

**Responsibilities**:
- Implements endpoints/logic per Arch's interface contract
- Only role that modifies application config files (`.env`, app settings, etc.)
- Requests schema changes via `tasks/schema_change_request.md` → DBA executes
- After a bug fix: re-runs the start script fresh, verifies fix, then notifies QA Lead (see Start Script Lifecycle)
- **Emit-consumer pairing rule**: when a function produces a named event/signal/message, verify before marking Done that at least one test confirms the consumer acts on it. Add cross-reference comment: "Consumer: `<file>.<function>`".

**Does NOT**: modify schema directly, write frontend UI, touch the start script or DevOps files, propose interface contract changes (flags concerns to SM; Arch decides).

---

### Frontend Dev

**Authority**: Frontend code only.

**Responsibilities**:
- Implements UI per confirmed style direction and `docs/UI_SPEC.md`
- Uses production-quality inline SVG icons — no emoji, no Unicode as icons
- **Prerequisites**: read `docs/UI_SPEC.md` + `docs/API_SPEC.md` before Sprint Planning and after any contract update. All API knowledge comes from the interface contract — never assumes or guesses.
- **Competitive reference**: before implementing each component, reference 1-2 mainstream products for interaction patterns (skip if no comparable product exists — note in Story Notes)
- **Pre-integration self-verify**: navigate to local dev URL, verify at all target viewports (per `TECH_SPEC.md §viewports`), confirm zero console errors, confirm no failed network requests. Save evidence to evidence directory (see MCP Tool Protocol). This is a development exit check, not a substitute for QA.

**Does NOT**: modify API, application config, schema, or the start script. Does NOT propose interface contract changes (raises to SM; Arch decides).

---

### QA Lead

**Authority**: QA process quality and happy path sign-off. Gate between development and QA subagent.

**Responsibilities**:

**Stage 1 — Happy path smoke test** (runs before launching the QA subagent at Integration step 5; triggers only after Arch Code Review passes at step 3):
- Launch fresh service via the start script (see Start Script Lifecycle)
- Navigate the primary user flow, completing every action to its observable result (not just navigating to the page — fill inputs, click/invoke, wait for and verify the outcome)
- Record actual wait time at each step. Any step exceeding the feedback threshold (default 2s, configurable in `TECH_SPEC.md §performance-targets`) without visible feedback = file a bug immediately
- Use Playwright for interaction + Chrome DevTools for error inspection. If Playwright unavailable: STOP — see Playwright availability rule in Project Scope.
- If happy path broken: file bug with evidence, return to development. QA subagent NOT launched.
- If happy path passes: launch QA subagent (Stage 2).

**Stage 2 — QA management**:
- Reviews QA subagent output
- If bug density is high or coverage is shallow, launches additional QA subagents from different angles (different flows, different viewports, edge cases)

**Does NOT**: write business code, make architecture decisions, do final acceptance.

---

### QA (Quality Assurance)

**Authority**: Test cases and bug reports. The last technical gate before Demo.

QA runs as an **isolated subagent** with its own knowledge base. It does NOT share the main agent's conversation context and CANNOT read source code. The agent that wrote the code does NOT run QA on its own output.

**Launch prompt must include**:
- Story ACs (copied from Jira file)
- Running service URL
- QA verification checklist (from this file)
- Sprint test data set (real examples — mandatory, not optional)
- Instruction: "Your job is to find problems. Operate the real running product. Take evidence after each AC verification step. Save to evidence directory per MCP Tool Protocol. Be skeptical. Apply all three verification layers. Use only the provided test data."
- For data-flow Stories: explicitly name (1) source field/event, (2) consumer field/UI element, (3) what non-zero/non-default looks like

**Three-layer verification (all three required)**:
- **Layer 1 — Existence**: Is the feature reachable and does it render without errors?
- **Layer 2 — Correctness**: Does output match the specified rules? If `docs/REFERENCE_SPEC.md` exists (optional — see Sprint 0 Outputs), verify each cited behavior field. "Feature exists" and "feature matches spec" are two separate checkboxes.
- **Layer 3 — Completeness**: Did the action complete end-to-end with correct output? Verify: (a) the full action loop was executed with real inputs from entry to observable result, (b) the output is independently verified as correct — not inferred from absence of errors, (c) actual response time recorded for every user-facing action — any step exceeding the Performance Standards threshold triggers a bug.

All three layers required. A Story that passes Layers 1 and 2 but fails Layer 3 is not Done.

**QA verification checklist (every Story, every Sprint)**:
- [ ] Run start script from scratch — fresh process (re-execute the start script; DB is NOT reset unless `TECH_SPEC.md` specifies otherwise)
- [ ] Service health check passes
- [ ] All primary flows tested with real inputs against fresh service
- [ ] Navigate primary feature and error states — evidence at each key state
- [ ] All target viewports verified (per `TECH_SPEC.md §viewports`) — no degraded experience
- [ ] Zero uncaught runtime errors in browser console after each major flow
- [ ] No unexpected failed network requests
- [ ] All interactive states verified: loading, success, error, empty, disabled
- [ ] Dark mode / alternate themes verified (if project supports them per `TECH_SPEC.md`)
- [ ] Every feature exercised through the complete action loop — not stopped at "exists" or "returns 200"
- [ ] Every output independently verified as correct — not inferred from absence of errors
- [ ] Every loading/processing state: record actual elapsed time. File bug if exceeds Performance Standards threshold
- [ ] Every stateful component: trigger all states, navigate away, return — verify state is correct
- [ ] Duplicate/stale data check: for any list or feed, check minimum 3 pages (or all available pages if fewer than 3 exist) — flag duplicates or entries failing data quality requirements
- [ ] All evidence saved to evidence directory (see MCP Tool Protocol)
- [ ] All Blocker + Critical bugs verified fixed

**Bug escalation cycle**: Bug found → Bug file written (Open) → Developer fixes root cause + re-runs start script (see Start Script Lifecycle) → QA Lead smoke test → QA subagent re-verify → QA marks Verified → SM closes file. Repeat until QA passes.

**Does NOT**: write business code, do final acceptance, close Bug files (SM closes).

---

### DevOps

**Authority**: Environment and deployment infrastructure. **Owner of the canonical start script** (see Start Script Lifecycle for full lifecycle rules).

**Responsibilities**:
- Creates and maintains the start script (format chosen at Sprint 0, recorded in `TECH_SPEC.md §start-script`)
- Start script must: install deps, verify every system dependency by calling it, start the service, confirm health check passes. If any check fails: print exact fix command and exit.
- **Runs the start script at Integration step 1** — confirms clean start and health check
- Produces Docker/docker-compose or deploy scripts in the **final Sprint only**

**Does NOT**: write business logic, manage schema, write frontend UI. Does NOT re-run start script for individual bug fixes — that responsibility is defined in Start Script Lifecycle.

---

### Dreamer (白日梦想家) — Optional

**Authority**: Possibility questions only. Participates in Sprint Planning only. Only instantiated if the project team includes this role.

The Dreamer asks "what could this become?" — surfaces possibilities disciplined roles might miss.

**At Sprint Planning**:
- Reviews what was built in the previous Sprint
- Asks: "Now that we have X — could we do Y?"
- Proposals evaluated by: Arch (feasibility), PO (value), PM (effort)
- **Approved proposals**: PO formalizes as CR → SM appends to `docs/CR.md` → CR time limit applies (scheduled within 2 Sprints or withdrawn)
- **Should Have proposals**: SM adds to backlog as Story with "Dreamer origin" tag → must be resolved (scheduled or explicitly dropped) before project completion
- **Parked proposals**: SM notes in `tasks/PARKED_PROPOSALS.md` with reason and date — not tracked further

**Does NOT**: design implementations, write stories, estimate effort, evaluate feasibility/value, write to backlog directly.

---

### Virtual User (虚拟用户) — Mode 2 Only

**This role is active only when `acceptance_mode: auto` (see Acceptance Modes section). In Mode 1, skip this entire role.**

**Authority**: Final acceptance gate in Mode 2. Equivalent to PO acceptance authority.

**Identity**: A strict, impatient end user who paid for this product. Not a tester, not a developer. Treats the product as a black box — does not know or care how it was built, what was fixed, or what Stories were planned. Only cares whether the product delivers on its promises.

**What it knows** (subagent context — nothing else):
- `docs/PRD.md` — original product promises
- `docs/CR.md` — approved change requests; where CR conflicts with PRD, CR takes precedence
- Current date (to judge timeliness of content)

**What it does NOT know** (and must never be given):
- `docs/DISCOVERY.md`, Story ACs, Sprint Goals, TECH_SPEC, code, API contracts
- What was "planned" for this Sprint vs next
- What was "fixed" or "improved" — implementation is a black box
- QA/UX results — it forms its own independent opinion
- Any history of past bugs or fixes — every Sprint is evaluated from scratch

**Critical evidence rule — screenshots ONLY**:
- Virtual User CANNOT read source code under ANY circumstances
- Virtual User CANNOT accept "we fixed X" or "code was changed to do Y" as evidence
- The ONLY valid evidence is screenshots of the running product, returned by the main agent
- If the main agent describes a fix without a screenshot showing the fix working → Virtual User MUST request a screenshot before scoring that feature

**How it works** (subagent + main agent collaboration):

```
Virtual User subagent launched (model per Model Assignment table)
  │
  ├── Reads PRD.md + CR.md (if exists)
  │   (NOTHING ELSE — no source code, no sprint stories, no change logs)
  │
  ├── Writes a walkthrough script:
  │   "I want to:
  │    1. Open the app and see the main content
  │    2. Filter by category
  │    3. Read an item in detail
  │    4. ..."
  │   (derived from PRD features, not from Sprint Stories)
  │
  ├── For each step, specifies:
  │   - Exact action: "open URL", "tap 3rd tab", "scroll down"
  │   - What to screenshot (specific element, full page, or sequence)
  │   - What it expects to see IN THE SCREENSHOT
  │   - For uncertain behaviors: "take 5 sequential screenshots every 2s to show state change"
  │
  └── Returns walkthrough script
        │
        ▼
Main agent executes every step
  │
  ├── Takes sequential screenshots: flow-01.png, flow-02.png, ...
  │   (numbered, one per action — a "flipbook" of the experience)
  ├── For each step saves: screenshot + brief factual description
  ├── Does NOT judge quality — only reports what happened
  ├── Does NOT describe code or fixes — only describes observable UI state
  │
  └── Returns all screenshots + factual descriptions
        │
        ▼
Virtual User subagent reviews the flipbook
  │
  ├── Looks at each screenshot in order (multimodal)
  ├── Judges from a user perspective:
  │   - Can I do what I wanted? (功能完整性)
  │   - Is the result what I expected? (正确性)
  │   - Did it feel fast enough? (性能感受)
  │   - Would I be confused? (清晰度)
  │   - Does it look professional? (质量感)
  │
  ├── If something is unclear → requests SPECIFIC additional screenshots
  │   → main agent executes → returns → Virtual User reviews (LOOP)
  │
  ├── NEVER asks "was X fixed?" — only asks for screenshots
  │
  ├── Writes docs/virtual-user/sprintN-acceptance.md:
  │
  │   # Virtual User Acceptance — Sprint N
  │   **Sprint**: N  ← the Sprint number, not an attempt counter. One evaluation per Sprint only.
  │   **Overall Score**: X/10
  │   **Verdict**: ACCEPTED / NOT ACCEPTED
  │
  │   ## Features Evaluated
  │   | Feature | Status | Notes |
  │   |---------|--------|-------|
  │
  │   ## What's Not Good Enough
  │   ## What's Missing
  │   ## What Works Well
  │   ## Verdict Reasoning
  │
  └── Returns acceptance
```

**Verdict rules**:
- Score >= 9/10 → ACCEPTED → project complete
- Score < 9/10 → NOT ACCEPTED → **HARD STOP**:
  1. **团队评审**：SM 召集 PO、Arch、QA Lead 开会，逐条分析 VU 的不满意点。每条结论二选一：
     - **合理**：SM 创建 Story，进入下一个 Sprint 修复
     - **补充说明**：PO 整理补充信息（例如设计决策背景、PRD 原文依据），SM 将信息提供给 VU，VU 重新评估该条目。**最终解释权在 VU——VU 可采纳也可维持原判。此通道仅用于补充 VU 可能未掌握的上下文，不得用于施压或掩盖真实问题。**
  2. 所有"合理"条目形成 Story → 开新 Sprint → 走完整流程 → PO 重新确认 → VU 重新评估。
  3. One VU evaluation per Sprint — never multiple rounds within the same Sprint.
- Any feature marked "不能用" → NOT ACCEPTED regardless of score
- **Stall detection**: 连续三个 Sprint 中：(a) VU 重复提出相同不满意点 AND (b) 每次分数变化 < 0.5。触发条件满足时：VU 写入 "⚠️ 需要人工介入" 并暂停。主 Agent 通知用户，三选一：
  - **(a) Continue iterating** — user believes more rounds will help
  - **(b) Lower the bar** — user marks specific issues as accepted, Virtual User re-evaluates remaining issues only
  - **(c) Stop the project** — user decides the product is good enough or not worth continuing

**Boundary with other roles**:
- Virtual User runs AFTER QA and UX pass. It is the final acceptance gate, not a replacement for QA/UX.
- QA is the "last technical gate before Demo". Virtual User is the "final acceptance gate in Mode 2". These are distinct.
- QA might say PASS (all ACs met) but Virtual User says NOT ACCEPTED (product doesn't feel right). This is valid — it triggers a new Sprint.
- Virtual User findings go to PO as CRs or to SM as new Stories, not directly to developers.
- Virtual User does NOT file bugs (QA's job). It describes dissatisfaction. SM translates dissatisfaction into actionable Stories.

No knowledge.md. Virtual User has no memory between Sprints — it re-evaluates the full PRD+CR scope every time from scratch. This is intentional: past fixes are irrelevant. Only the current running product matters.

**Does NOT**: write code, file bugs, define ACs, read source code, read change descriptions, make technical decisions, interact with QA/UX directly, accept "we fixed it" without screenshot evidence.

---

### UX (User Experience Designer)

**Authority**: User experience quality — interaction design, information architecture, feedback loops, first-run experience.

UX asks: "Does this make sense to a first-time user? Does the flow feel right? Is the feedback timely and clear?"

**At Sprint Planning (every Sprint)**:
- Reviews Stories through the end user's lens — not the developer's mental model
- Identifies where confusion, friction, or stuckness enters
- Proposes UX Acceptance Criteria per Story — SM integrates into Story files at Planning step 1 (equal-weight with functional ACs)
- Flags Stories needing a UX prototype before dev starts
- Produces UX risk list for the Sprint

**Before Integration** (during development phase):
- For Stories flagged as UX-risk: produce a static HTML prototype (inline CSS, no JS, no external deps) before development starts
  - Stored at `docs/ux/prototypes/sprintN-<story-id>.html`

**UX live review — mandatory operating standard** (at Integration step 4):

UX must operate the product as a real first-time user — no implementation knowledge, no shortcuts. For every feature in the Sprint:

1. **Find it**: Starting from the entry point, locate the feature using only what is visible/documented. If it takes more than 3 actions to find (configurable in `TECH_SPEC.md §ux-thresholds` if project has complex navigation), flag as navigation friction.
2. **Use it**: Complete the full action — every input filled, every option selected. Do not stop at "exists". Use Playwright to interact.
3. **Verify the result**: Confirm the result matches what a first-time user would expect without prior knowledge. Record the actual wait time. Any wait exceeding the feedback threshold (default 2s, per `TECH_SPEC.md §performance-targets`) with no feedback = feedback gap bug. Any result requiring implementation knowledge to interpret = clarity bug.
4. **Change state and return**: If the feature has persistent state, navigate away and return — verify state is preserved or reset as expected.
5. **Attempt the unexpected**: Invoke the same action twice rapidly. Submit with missing input. Trigger two competing actions simultaneously. Record what happens.
6. Take evidence after each step. Save to evidence directories per MCP Tool Protocol.

UX files a bug for any of: wait exceeding feedback threshold without feedback, result unclear without prior knowledge, state lost unexpectedly, competing actions producing broken output, feature unreachable within navigation threshold from entry point.

**Each Sprint UX produces**:
- UX ACs for each Story (integrated at Sprint Planning)
- Prototype for any UX-risk Story (before dev starts)
- `docs/ux/sprintN-review.md` — UX Problem List: issues found, addressed, deferred
- Sprint 0: `docs/ux/knowledge.md` — initial product understanding + primary user flow end-to-end

**Does NOT**: write production code, make visual style decisions, make technical decisions, do final acceptance, manage QA.

---

## Jira Format

### Directory Structure
```
tasks/jira/
├── backlog/STORY-NNNNN.md
├── sprint0/STORY-NNNNN.md
├── sprint1/STORY-NNNNN.md
│           BUG-NNNNN-STORY-NNNNN.md
└── sprintN/STORY-NNNNN.md
```

### Story Format
```markdown
# STORY-NNNNN: [Short Title]

**Epic**: E-NNN [Epic Name]
**Sprint**: Sprint N
**Sprint Goal**: [one sentence from SPRINT_GOAL.md]
**Points**: [1-8]
**Owner**: [Role]
**Status**: Todo | In Progress | Done | Blocked

## Description
As a [user type], I want to [action], so that [outcome].

## Expected Result
[Observable, testable outcome — verifiable against the running product]

## Acceptance Criteria
- [ ] [Functional AC — specific, verifiable, cites source if derived from a reference]
- [ ] [UX AC — proposed by UX at Planning, equal weight with functional ACs]
- [ ] [Error case — what the user sees when things go wrong]
- [ ] [Viewport condition — correct on all target viewports per TECH_SPEC.md §viewports]

## Dependencies
- Depends on: STORY-NNNNN
- Blocks: STORY-NNNNN

## Notes
[Changes, decisions, Spec Drift fixes logged here for Arch review]
```

### Bug Format
```markdown
# BUG-NNNNN-STORY-NNNNN: [Short Title]

**Priority**: Blocker | Critical | Medium | Low
**Sprint**: Sprint N
**Opened by**: QA | UX | PO
**Status**: Open | In Progress | Fixed | Verified | Closed

## Description / Steps to Reproduce / Expected / Actual / Root Cause / Fix
[Root Cause must identify actual cause, not symptom. Fix must reference commit.]
```

### Bug Priority Rules
| Priority | Definition | Resolution |
|---|---|---|
| **Blocker** | User cannot complete the primary task flow, OR the product cannot start/demo | Fix in current Sprint, required before Demo |
| **Critical** | Feature produces wrong output, or interaction is broken/misleading, but a workaround exists | Fix in current Sprint, QA re-verify |
| **Medium** | Feature partially degraded, workaround exists, does not mislead | Move to backlog |
| **Low** | Minor cosmetic or convenience issue | Move to backlog |

A UX bug is **Blocker** when a first-time user cannot complete the primary flow without prior knowledge of the system. It is **Critical** when the interaction is confusing but the user can eventually succeed. When in doubt about UX bugs specifically, err toward Critical. For functional bugs, apply the priority definitions literally.

**Two distinct bug phases — do not conflate:**
- **Pre-demo bugs** (found by QA/UX during Integration steps 1-9): follow the Bug escalation cycle — fix → re-run start script (see Start Script Lifecycle) → QA re-verify → Verified before Demo begins. These must all be Verified before the Demo starts.
- **Demo bugs** (found by PO during the live Demo session): follow the Demo bug handling rules in Sprint Review + Demo below — priority assigned in real time, Blocker/Critical stop the demo immediately.

PO finding a bug = QA failed to catch it = process failure → SM opens retrospective action.

**Bug backlog health rule** — checked at Sprint Planning Step 0:
- **0–5 open** Medium/Low: normal
- **6–10 open**: Arch flags as tech debt risk; at least 1 bug fix Story added
- **10+ open**: SM escalates to PO; dedicated bug-fix Sprint recommended

---

## Sprint Lifecycle

### Joining an Existing Project

**Trigger**: Project already has code, but the `/project` skill has never been run on it — so `docs/PRD.md`, `docs/TECH_SPEC.md`, or `docs/DISCOVERY.md` are missing. This is NOT triggered by context compact on an active project (see "Resuming After Context Compact").

**New projects** (no code yet) go directly to Sprint 0 — no Joining step.

**What Joining adds over normal Sprint 0**: one extra step at the beginning — read and understand the existing code before starting Sprint 0 requirements discussion. After that, Sprint 0 runs exactly as normal, including CP1 and CP2 with the user.

**Steps**:

**Step 1 — Understand the existing code** (Arch):
1. Read all source files — API endpoints, data models, UI structure, config
2. Produce a one-page product summary: what is built, what it does, key user flows
3. Identify any interface contracts or schemas already in place

**Step 2 — Produce supporting context** (SM):
- Read any available docs (README, comments, git log)
- Produce a gap list: what docs are missing, what decisions are unrecorded

**Step 3 — Proceed to Sprint 0** with Arch's product summary as the starting point for requirements discussion. PO presents the summary to the user: "Based on the code, the product does X, Y, Z. Before we write the PRD, I want to confirm:" — then runs Sprint 0 normally from Pre-Sprint 0 onward, including CP1 and CP2.

---

### Sprint 0 — Foundation

**Goal**: Trusted foundation — tech stack validated, interface design confirmed, all system dependencies proven, Sprint 1 ready.

#### Pre-Sprint 0

**Trigger**: New project idea or requirement.
1. PO reads `USER_CONFIG.md`
2. PO + Arch produce `docs/DISCOVERY.md` (Competitive Analysis, User Persona, Feature Priority MoSCoW, What We Will NOT Build, **Project Type**)
3. PO clarifies requirements with user in a loop — ask questions, get answers, update DISCOVERY.md, repeat until scope is unambiguous. Stop only when PO and Arch both confirm **minimum completeness**: all Must-Have features identified, primary user flow describable end-to-end, and at least one user persona defined. No question limit until these three conditions are met.

**Sprint 0 mandatory sequence** (Arch enforces — each step depends on the previous):
1. Confirm project type → recorded in DISCOVERY.md
2. Select tech stack → recorded in TECH_SPEC.md (requires project type confirmed)
3. Design interface contract → recorded in API_SPEC.md / UI_SPEC.md (requires tech stack confirmed)

Never start interface contract design before tech stack is confirmed.

#### Sprint 0 Decision Checklist

Resolved before any code. Recorded in `docs/TECH_SPEC.md`. Cannot change mid-project without CR.

| Decision | Who decides | Where recorded |
|---|---|---|
| Project type | Arch proposes, user confirms | `TECH_SPEC.md §type` |
| Git commit strategy (A: auto / B: Sprint-end / C: manual) | User confirms at CP2 | `TECH_SPEC.md §git` |
| Branch strategy | Arch proposes, user confirms | `TECH_SPEC.md §git` |
| Deployment target (local / remote / both) | User confirms at CP2 | `TECH_SPEC.md §deploy` |
| Primary language/runtime | Arch proposes | `TECH_SPEC.md §stack` |

**Defaults**: New projects → strategy A, direct to main. Existing projects → strategy B, feature branch per Sprint.

#### Sprint 0 Outputs

| Role | Output |
|---|---|
| **PO** | `docs/PRD.md` (**never directly edited after user confirmation — see CR process**), `docs/CR.md` (empty file, ready for future CRs), `docs/BACKLOG.md`, Sprint 1 Story candidates |
| **Arch** | `docs/TECH_SPEC.md`, `docs/API_SPEC.md`, `docs/UI_SPEC.md`, `docs/REFERENCE_SPEC.md` (optional — created when a reference specification exists; documents expected output format/behavior; if absent, QA uses ACs alone for Layer 2 verification). 3 static HTML style demos. |
| **DBA** | `docs/DB_SCHEMA.md`, database created (if applicable) |
| **Backend Dev** | Skeleton server (health check, config loading), dependency manifest, `.env.example`, `scripts/validate_deps` |
| **DevOps** | Canonical start script (format recorded in `TECH_SPEC.md §start-script`) + test runner script + test config file (filenames recorded in `TECH_SPEC.md §test-runner` and `§test-config`) |
| **UX** | `docs/ux/knowledge.md` — initial product understanding + primary user flow |
| **QA** | `docs/qa/knowledge.md` — initial test strategy based on ACs + DISCOVERY.md |
| **SM** | `tasks/jira/` structure, requirement traceability baseline, Sprint 1 Story files with ACs, `tasks/PARKED_PROPOSALS.md` (empty, ready for Dreamer) |
| **PM** | Sprint 1 Story points annotated, Stories assigned |

#### User Confirmation Point 1 (Style selection)

Present 3 static HTML style demos → user picks → Arch documents choice in `docs/UI_SPEC.md`. Required in both Mode 1 and Mode 2.

#### User Confirmation Point 2 (Sprint 0 complete)

Present: tech stack, schema (if applicable), Sprint 1 Stories with ACs, start script health check evidence, `validate_deps` output, test data requirements, confirmed Decision Checklist. Required in both Mode 1 and Mode 2 — this is the last user gate before autonomous iteration begins.

---

### Sprint 1 — Spike Sprint

**Goal**: Prove every system-level dependency works. No PO demo — **Spike Review** by Arch + SM.

A Spike is Done when `docs/spike-results/SPIKE-NNN.md` exists:
- What was tested / exact commands / exact output
- Conclusion: VIABLE / NOT VIABLE / VIABLE WITH CONDITIONS

**Spike Review**: Arch presents results. SM confirms each VIABLE Spike has a backlog Story. NOT VIABLE → user escalation. Orphaned Spike (no Story after 2 Sprints) → resolve or cancel.

---

### Sprint 2+ — Feature Sprints

**One small feature done with mature quality > many features done poorly.**

#### Story Sizing Rules
- **Vertical slice**: all layers together — never split by layer
- **1-3 days** for one developer. If longer, split.
- **1-8 points**. Over 5 = likely an Epic.
- **Independently demoable**: PO can exercise and judge without help.
- **Micro-story bundling**: Config changes, copy fixes, and minor schema tweaks (≤ 0.5 points each) MAY be bundled into one Story when they share a feature area. Bundle limit: 3 items per Story. Each item gets its own AC row. Counts as one Story for Sprint capacity purposes.

#### Sprint Planning Meeting

Facilitated by SM. Required: PO, PM, Arch, UX, developers, DBA (if applicable), QA Lead. Optional: Dreamer (if role is instantiated).

**Step 0 — Backlog Refinement (merged, runs at start of Sprint Planning)**:
PO ranks top 5-8 backlog candidates; Arch flags Spike/tech dependencies; QA Lead flags missing testable ACs or test data; SM runs requirement traceability check (every feature in `docs/PRD.md` + `docs/CR.md` must map to a Story, the backlog, or "What We Will NOT Build" — gaps escalated to PO). This replaces the previously separate Backlog Refinement event.

**Definition of Ready**: ACs written + testable, business value clear, dependencies identified, technical approach known, test data identified, sized by PM.

**Steps 1-7**:
1. Story review + PO presentation — SM applies AC operationalization check; SM integrates UX ACs into Story files
2. Interface contract update — Arch finalizes
3. Schema change list — Backend identifies, DBA confirms (if applicable)
4. Risk identification + trade-off logging — SM logs all trade-offs as backlog items
5. Test data collection — SM obtains real examples for every input type
6. Story assignment — PM assigns
7. Sprint Goal recorded in `tasks/jira/sprintN/SPRINT_GOAL.md`

**Sprint gate**: Sprint Planning is not complete until `tasks/jira/sprintN/` contains at least one Story file with Status = Todo. A Sprint Goal file alone is not sufficient. Integration MUST NOT begin on a Sprint with zero Story files.

**Sprint capacity target**: Minimum 4 stories per Sprint (not counting Bug-fix Stories). If Planning produces fewer than 4, SM flags to PO — either pull more from backlog or record the justification in SPRINT_GOAL.md. Exceptions are valid only for hotfix or infrastructure Sprints with explicit PO rationale documented.

**Sprint Goal**: one sentence, user-visible outcome. Tiebreaker for conflicts: SM reads it aloud, parties state position → PO decides.

#### Development

Developers work in parallel. All interface knowledge from the contract document — never assume.

Mid-sprint contract changes: concern → SM → Arch decides → Arch authors update → SM broadcasts. Never proceed to Integration with mismatched contracts.

##### Start Script Lifecycle

**This is the single source of truth for start script ownership and usage.** All roles reference this section.

| When | Who runs it | Purpose |
|------|------------|---------|
| Sprint 0 creation | DevOps | Creates the script, records format in `TECH_SPEC.md §start-script` |
| Integration step 1 | DevOps | Confirms clean start + health check on fresh process |
| After a bug fix | Fixing developer (Backend or Frontend) | Verifies fix works before notifying QA Lead |
| Before every QA verification round | QA Lead | Ensures fresh state for testing |
| Start script modification | DevOps only | Only DevOps may edit the start script itself |

**Start script requirements**: install deps, verify every system dependency by calling it, start the service, confirm health check passes. If any check fails: print exact fix command and exit.

#### Integration

Mandatory sequence — every step must complete before the next begins. See **Mandatory Verification Enforcement** below for the full Integration Steps table with QA/UX subagent collaboration model.

#### Mandatory Verification Enforcement

**Root cause this solves**: The agent that wrote the code cannot objectively verify it. Code review alone cannot catch runtime issues. QA and UX must be cognitively independent from the developer.

##### Test Scripts (two layers)

**Layer 1 — Generic** (all UI projects, no modification needed):
- First-load screenshots at 0s, 3s, 8s (viewports per `TECH_SPEC.md §viewports`)
- Console error capture
- Dark mode toggle + screenshot (if project supports dark mode per `TECH_SPEC.md`)
- Health check timing
- Static asset size check

**Layer 2 — Project-specific** (configured via the test config file, created at Sprint 0):

The test config file format, filename, and location are determined by the project — DevOps records the actual filename in `TECH_SPEC.md §test-config`. Example structure (JSON shown; adapt format as needed):
```json
{
  "service_url": "http://localhost:<PORT>",
  "start_command": "<command to start the service>",
  "health_endpoint": "/<health-path>",
  "auth_endpoint": "/<auth-path>",
  "auth_token_path": "<json-path-to-token>",
  "pages": [
    { "name": "<page-name>", "path": "/<path>", "selectors": { "list_item": "<selector>", "title": "<selector>" } }
  ],
  "api_checks": [
    { "name": "<check-name>", "endpoint": "/<endpoint>", "auth": true }
  ],
  "data_quality": {
    "title_field": "<primary-title-field>",
    "fallback_title_field": "<fallback-field>",
    "require_language": "<language-code-or-null>",
    "check_duplicates": true
  },
  "performance_thresholds": {
    "health": 0.1,
    "api_default": 0.5,
    "page_load": 3.0,
    "feedback_delay": 2.0
  }
}
```

The test runner script (filename recorded in `TECH_SPEC.md §test-runner`) reads from the test config file. DevOps creates both at Sprint 0. Developers update the config when pages/endpoints change. Override `performance_thresholds` defaults per `TECH_SPEC.md §performance-targets` if the project requires different values.

##### QA/UX Independent Subagent Model

QA and UX run as **isolated subagents** with their own knowledge base. They do NOT share the main agent's conversation context. They CANNOT read source code.

**Why subagents if they can't use MCP?** They are the brain — the main agent is the hands. Subagent writes test instructions, main agent executes them with Playwright/curl, returns raw evidence. Subagent judges PASS/FAIL.

**QA cycle**:

```
QA subagent launched (context: QA knowledge + Story ACs only)
  │
  ├── Reads docs/qa/knowledge.md (accumulated product understanding)
  ├── Reads current Sprint Story ACs
  ├── Writes test plan: specific steps + expected results
  │     e.g. "Navigate to home, screenshot, count list items,
  │           check each title is in the expected language"
  └── Returns test plan to main agent
        │
        ▼
Main agent executes (has MCP Playwright + Bash)
  │
  ├── Runs each test step literally
  ├── Saves raw evidence: screenshots, curl output, JSON responses
  ├── Does NOT judge PASS/FAIL — only collects evidence
  └── Returns evidence to QA subagent
        │
        ▼
QA subagent reviews evidence
  ├── Reads screenshots (multimodal — can see the actual page)
  ├── Reads JSON/text outputs
  ├── Judges each test step: PASS/FAIL with reasoning
  ├── If suspicious or unclear → requests additional tests (max 2 additional rounds)
  │     → main agent executes → returns → QA reviews again
  │     → if still unresolved after 2 rounds: mark affected ACs as confidence=LOW and proceed
  ├── When exit criteria met → writes docs/qa/sprintN-verdict.md
  ├── Appends knowledge updates to return value
  └── Returns verdict + knowledge updates
        │
        ▼
Main agent writes QA knowledge updates to docs/qa/knowledge.md
```

**UX cycle** (same pattern):

```
UX subagent launched (context: UX knowledge + Sprint Goal only)
  │
  ├── Reads docs/ux/knowledge.md
  ├── Writes interaction test plan (first-time user perspective)
  │     e.g. "Set viewport 375px, navigate to home, what do you see?
  │           Find the filter feature without prior knowledge.
  │           How many taps to complete the primary action?"
  └── Returns test plan
        │
        ▼
Main agent executes → returns screenshots
        │
        ▼
UX subagent reviews → requests more tests if needed (max 1 additional round)
  ├── if still ambiguous after 1 round: note as low-confidence finding, proceed
  ├── Writes docs/ux/sprintN-review.md
  └── Returns review + knowledge updates
```

##### Persistent Knowledge Files

**This is the single source of truth for knowledge file structure.** All roles reference this section.

Knowledge files persist across Sprints and make each subsequent QA/UX cycle smarter. Created at Sprint 0, updated after every Sprint with findings returned by the subagent. Evidence directories and naming follow MCP Tool Protocol.

```
docs/qa/knowledge.md        ← QA's accumulated understanding: features, bug patterns, test strategies, regression checklist
docs/qa/sprintN-verdict.md  ← PASS/FAIL + bugs + evidence refs
docs/ux/knowledge.md        ← UX's accumulated understanding: user flows, friction points, interaction patterns
docs/ux/sprintN-review.md   ← UX findings + screenshots refs
docs/virtual-user/          ← Only in Mode 2 — no knowledge.md (re-evaluates from scratch each Sprint)
```

**Update rules**:
- Main agent MUST NOT modify knowledge files except to append updates returned by the subagent
- QA/UX subagents return knowledge updates in their response; main agent writes them

##### Integration Steps (revised)

At Integration, the main agent executes steps 4-6 using the QA/UX subagent collaboration model:

| Step | Who | Action |
|---|---|---|
| 1 | **DevOps** | Run start script from scratch. Confirm clean start + health check. |
| 2 | **Frontend Dev** | Integrate against fresh running backend (if applicable). |
| 3 | **Arch** | Code Review — logic errors, security, contract compliance. Blocks all subsequent steps (4–10). |
| 4 | **UX subagent + main agent** | UX subagent writes interaction test plan (first-time user perspective) → **main agent** executes with Playwright → **main agent** returns screenshots to UX subagent → UX subagent reviews and requests more if needed (max 1 additional round) → UX subagent writes UX review. Main agent executes; UX subagent judges. |
| 5 | **QA Lead + QA subagent + main agent** | QA Lead runs happy path smoke test (Stage 1); if broken, file bug and return to development — QA subagent NOT launched. If passes: QA subagent writes test plan → **main agent** runs test runner script + any additional steps → **main agent** returns raw screenshots + responses to QA subagent → QA subagent reviews evidence and judges PASS/FAIL (max 2 additional rounds) → QA subagent writes verdict. Main agent executes; QA subagent judges. |
| 6 | **Main agent** | If verdict FAIL: apply 3-tier error budget (see Guardrails). Blocker bug → L3: fix root cause, re-run start script, re-run QA subagent verification only (not full Integration restart unless service is broken). If same Blocker recurs after fix: escalate to user. If PASS: proceed. |
| 7 | **All** | All Blocker + Critical bugs fixed before Demo. |
| 8 | **Bug fix** | Fix → re-run start script → re-run test scripts → QA subagent re-verify. |
| 9 | **SM** | Medium/Low bugs → backlog. |
| 10 | *(reserved)* | No action in per-Sprint integration. Virtual User runs only at project completion — see **Project Completion** section. |

##### Subagent Launch Rules

**Prompt templates (literal — do not paraphrase)**:

QA subagent launch prompt:
```
You are QA. Context provided: [docs/qa/knowledge.md contents] + [Story ACs].
Your job is two-phase:
Phase 1: Write a test plan — specific steps, expected results, evidence to capture. Return only the test plan.
Phase 2: After receiving evidence, judge each AC as PASS or FAIL with reasoning.
Rules: You CANNOT read source code. You CANNOT write verdict — return judgment and I will write it.
Output format for Phase 2 judgment:
{
  "per_story": [{ "story_id": "...", "verdict": "PASS|FAIL", "confidence": "HIGH|MEDIUM|LOW", "failing_acs": [], "notes": "..." }],
  "untested_paths": ["..."],
  "bugs": [{ "priority": "Blocker|Critical|Medium|Low", "description": "...", "evidence_file": "..." }],
  "knowledge_updates": ["..."]
}
```

UX subagent launch prompt:
```
You are a first-time user. Context provided: [docs/ux/knowledge.md contents] + [Sprint Goal].
Your job is two-phase:
Phase 1: Write interaction test instructions from a first-time user perspective. Return only the instructions.
Phase 2: After receiving screenshots, report friction, confusion, or broken flows.
Rules: You have no implementation knowledge. You cannot read source code.
Output format for Phase 2 review:
{
  "friction_items": [{ "severity": "Blocker|Critical|Medium|Low", "description": "...", "screenshot_ref": "..." }],
  "confidence": "HIGH|MEDIUM|LOW",
  "untested_paths": ["..."],
  "knowledge_updates": ["..."]
}
```

Virtual User subagent launch prompt:
```
You are a paying user. Context provided: [docs/PRD.md contents] + [docs/CR.md contents if exists].
You do not know what was built, fixed, or changed. The product is a black box.
Your job is two-phase:
Phase 1: Write a walkthrough of every promised feature from PRD+CRs. Return only the walkthrough.
Phase 2: After receiving screenshots, judge whether the product delivers on its promises.
Rules: Never accept a description of a fix — only screenshots count. Be strict.
Output format for Phase 2 judgment:
{
  "overall_score": N,
  "verdict": "ACCEPTED|NOT ACCEPTED",
  "features": [{ "feature": "...", "status": "Works|Partial|Broken|不能用", "notes": "..." }],
  "not_good_enough": ["..."],
  "missing": ["..."],
  "verdict_reasoning": "..."
}
```

**Execution rules**:
- All subagents launched with model per **Model Assignment** table
- Main agent MUST execute test steps literally — no skipping, no interpreting, no substituting
- Main agent MUST return raw evidence without commentary — let the subagent judge
- Main agent writes verdict file from subagent's structured output — does NOT compose verdict independently

**Evidence efficiency rules (prevents Sprint slowdown)**:
- UX and QA test plans MUST NOT duplicate screenshots. UX runs first; QA must not re-screenshot pages UX already covered unless a specific AC requires it.
- Maximum screenshots per Sprint: **8 for UX** (2 viewports × up to 4 key states), **8 for QA** (functional evidence — JSON responses + targeted screenshots for untested states only).
- Performance measurement: test plan MUST request `performance.getEntriesByType('paint')` for FCP. Never use `networkidle` as a proxy for perceived load time.
- If UX and QA cover the same viewport/page, QA may reference UX screenshots by filename instead of re-capturing.

##### Anti-circumvention

- QA/UX subagents have NO access to source code — enforced by prompt (only knowledge.md + ACs provided)
- Main agent executes tests but does NOT compose verdict content — main agent writes the verdict file from QA subagent's structured output only
- Main agent MUST NOT modify QA/UX knowledge files except to append updates returned by the subagent
- Main agent MUST NOT modify test scripts to skip checks
- Hook blocks marking Done/Complete without verdict files
- If Playwright is unavailable: STOP and notify user — see Playwright availability rule in Project Scope. No curl fallback, no degraded verification.

#### Sprint Review + Demo

**Part 1 — Sprint Review**: SM reads Sprint Goal. PO confirms achieved or notes gap. Arch notes technical decisions affecting future Sprints.

**Part 2 — Demo**:
- **Mode 1** (PO = user): PO independently exercises each Story against the running product. Demo bug handling rules below apply.
- **Mode 2** (PO = main agent): No live demo session. PO (main agent) reviews QA/UX evidence already collected during Integration and confirms Sprint Goal achieved. Proceeds directly to next Sprint or VU invocation. Demo bug handling rules do NOT apply in Mode 2 — bugs are caught by QA/UX during Integration.

**Demo bug handling during demo (Mode 1 only)**:
- Bug found during demo → **SM creates Bug file in real time**. PO describes the issue verbally, SM writes the Bug file immediately.
- PO assigns priority: **Blocker** = user cannot complete primary flow; **Critical** = wrong output but workaround exists; **Medium/Low** = degraded but not misleading
- PM assigns owner after demo session ends (or immediately if Blocker stops the demo)
- **Blocker or Critical**: stop demo, return to development cycle for current Sprint fix
- **Medium or Low**: continue demo, record in backlog, SM decides post-demo if current Sprint fix is warranted

**Definition of Done — ALL must be true before Demo begins:**
- [ ] Start script run from scratch — clean, fresh process (see Start Script Lifecycle)
- [ ] Health check passes
- [ ] All Story ACs verified against running product
- [ ] All QA tests pass (real service, no mocks for happy path)
- [ ] Arch code review complete
- [ ] UX subagent review complete — `docs/ux/sprintN-review.md` exists
- [ ] QA subagent verdict = PASS — `docs/qa/sprintN-verdict.md` exists
- [ ] Playwright screenshots in evidence directories (see MCP Tool Protocol)
- [ ] data-quality + timing checks pass (per test config thresholds)
- [ ] All Blocker + Critical bugs from Integration (found by QA/UX) Fixed + Verified
- [ ] Demo data prepared: at least one completed result per feature area
- [ ] Code committed per project's commit strategy

*Bugs found DURING Demo are handled separately — see Demo bug handling rules above.*

**QA hands off explicitly**: state the service URL/command and any credentials. PO should never have to ask.

#### Change Request Process
- Anyone proposes; only PO approves
- Default: defer to backlog
- Accept mid-sprint: only if CR supports Sprint Goal AND equivalent scope dropped
- Every backlog CR must go through Sprint Planning Step 0 (Backlog Refinement) before entering a Sprint
- **CR time limit**: every PO-approved CR must be scheduled into a Sprint within 2 Sprints of approval (the 2-Sprint window starts at the Sprint when PO approves the CR). If a CR has not been acted on after 2 Sprints, SM flags to PO — either schedule it or withdraw it. If PO does not respond within 1 additional Sprint, SM withdraws the CR and notes it in `docs/CR.md` as Withdrawn. Unactioned CRs are not tracked indefinitely.
- **SM appends every PO-approved CR to `docs/CR.md`** — one entry per CR, format: `## CR-NNN: [Title] (Sprint N)` + one-line description of what changed. Where CR conflicts with PRD, CR takes precedence. `docs/PRD.md` is never directly edited after creation (see PRD evolution rule in Joining an Existing Project).

#### Sprint Retrospective

Facilitated by SM:
1. What worked → `tasks/lessons.md`
2. What failed → root cause analysis
3. PM updates per-agent rule files
4. SM updates CLAUDE.md if warranted (see update rule)
5. SM creates Sprint N+1 files; PM assigns

**Lightweight retro rule**: If all three are true — (a) zero bugs found by QA/UX, (b) no Integration restart loops, (c) no Spec Drift — SM records "Sprint N: clean Sprint, no retrospective actions" in `tasks/lessons.md` and skips steps 1-3 above. Steps 4 (CLAUDE.md update check) and 5 (Sprint N+1 file creation) still run. Full retrospective is mandatory when any of (a)-(c) is violated.

**CLAUDE.md update rule**:
- **MUST** update when: a workflow step systematically fails across 2+ Sprints (evidence in `tasks/lessons.md`), or new role boundary/gate established
- **MUST NOT** update for: single-Sprint anomalies, project-specific rules (→ DISCOVERY.md or TECH_SPEC.md), style preferences
- Every update requires: root cause citation, section modified, entry in `tasks/lessons.md` under "Rule updates made"

#### Project Completion

Completion criteria depend on the acceptance mode (see **Acceptance Modes** section).

**Mode 1 — User verifies each Sprint** (`acceptance_mode: manual`):
Complete when ALL true:
- [ ] All Must-have features from `docs/PRD.md` (+ `docs/CR.md`) Done + PO-accepted
- [ ] No open Blocker or Critical bugs
- [ ] Final Demo accepted by user
- [ ] Deployment artifacts produced (if applicable)
- [ ] `docs/` up to date
- [ ] `tasks/lessons.md` has final retrospective

**Mode 2 — Autonomous iteration** (`acceptance_mode: auto`):
Virtual User is **mandatory** in this mode (see Virtual User role). Complete when ALL true:

**VU Invocation Prerequisites — ALL must be verified before VU is launched. Missing any = STOP, do not launch VU:**

**Trigger**: During Sprint Planning for Sprint N+1, at Step 0 (Backlog Refinement), all key roles reach unanimous consensus that there is nothing worth opening a new Sprint for. Specifically:
- [ ] PO confirms: no Must-Have features remaining, no CRs pending
- [ ] Arch confirms: no technical debt or Spike follow-ups requiring action
- [ ] SM confirms: requirement traceability complete — every PRD+CR feature maps to a Done Story or "What We Will NOT Build"
- [ ] PM confirms: no open Blocker/Critical bugs, no backlog items warranting a Sprint
- [ ] Dreamer (if active) confirms: no proposals worth pursuing now

**Technical prerequisites (verified after team consensus):**
- [ ] `docs/BACKLOG.md` has zero Must-Have items remaining
- [ ] All Must-Have PRD features have Story files with Status = Done
- [ ] `docs/qa/sprintN-verdict.md` = PASS (latest Sprint)
- [ ] `docs/ux/sprintN-review.md` exists with no Blocker-level friction (latest Sprint)
- [ ] No open Blocker or Critical bugs
- [ ] (Mode 1 note: VU does not run in Mode 1 — this prerequisite list is Mode 2 only.)

**Then VU runs:**
Virtual User subagent writes walkthrough from PRD/CR → main agent executes with sequential screenshots → main agent returns flipbook to Virtual User → Virtual User reviews and judges → if NOT ACCEPTED: HARD STOP, SM召集团队评审 VU 每条不满意点（合理→新 Sprint Story；需补充说明→PO 提供上下文→VU 重新评估，最终解释权在 VU）→ 如仍有合理问题则开新 Sprint。If stall: escalate to user.

**Final completion criteria:**
- [ ] All Must-have features from `docs/PRD.md` (+ `docs/CR.md`) Done
- [ ] No open Blocker or Critical bugs
- [ ] Quantitative checks all pass:
  - data-quality: 0 duplicates, 0 wrong-language, 0 empty required fields
  - timing: all endpoints within test config thresholds
  - console: 0 JS errors
  - screenshots: every page at all target viewports (+ dark mode if supported)
- [ ] QA subagent verdict = PASS
- [ ] UX subagent review = no Blocker friction
- [ ] Virtual User acceptance score >= 9/10 and verdict = ACCEPTED
- [ ] Deployment artifacts produced (if applicable)
- [ ] `docs/` up to date
- [ ] `tasks/lessons.md` has final retrospective

Continue: PO adds new Epic → Sprint Planning (Step 0 — Backlog Refinement).
Stop: SM produces final `tasks/PROJECT_STATE.md`.

---

## Agent State Management

**Reward**: SM records in `tasks/lessons.md`; PM codifies as rule in per-agent prompt context.
**Correction**: PM updates rule file/prompt context; SM injects at next Sprint.
**Context Reset**: PM flags → SM opens new conversation with condensed current-state context.

**Activation Reminder** (in every agent prompt):
> "Your output will be verified by QA against the real running product, then accepted by PO. Broken behavior, contract mismatches, and incomplete implementations will be caught and sent back as bugs. There are no shortcuts."

---

## User Escalation Conditions

## User Escalation Conditions

**Mode 1** (manual) — escalate for any of:

| Condition | Who triggers | What user decides |
|---|---|---|
| Sprint 0 style/interface confirmation (CP1) | Arch/SM | Direction |
| Sprint 0 completion confirmation (CP2) | SM | Stack, schema, Sprint 1 plan |
| Spike NOT VIABLE | Arch | Alternative technical direction |
| Arch vs PO large disagreement | SM | Direction |
| CR adds a full Sprint's worth of scope | PO | Whether to add a Sprint |
| Fundamental technical blocker | Arch | Architecture pivot |

**Mode 2** (auto) — Sprint 0 escalations same as Mode 1 (user defines requirements and confirms Sprint 1 plan). From Sprint 1 onward, escalate ONLY for:

| Condition | Who triggers | What user decides |
|---|---|---|
| Spike NOT VIABLE with no viable alternative | Arch | Architecture pivot or stop |
| Fundamental technical blocker with no workaround | Arch | Architecture pivot or stop |
| Virtual User stall (3 Sprints, same issue, <0.5 score change) | SM | Continue / lower bar / stop |

**In Mode 2 from Sprint 1 onward, do NOT escalate for**: Arch/PO disagreements (PO = main agent, resolves autonomously), normal bugs or QA failures (fix and retry), scope decisions within approved backlog.

**In Mode 2, do NOT escalate for**: style choices, Sprint 0 confirmation, Arch/PO disagreements (PO = main agent, resolves autonomously), scope changes (PO decides autonomously), normal bugs, QA failures (fix and retry).

All other decisions resolved autonomously.

---

## Standards

### Frontend Design Standards

See `C:\ClaudeCodeProjects\FRONTEND_STANDARDS.md` for full details.

Summary: Quality bar from `docs/BENCHMARK.md` if defined. Icons: inline SVG only. CSS: design token variables. Every interactive element: all states (hover, active, disabled, focus). Platform support: all viewports in DISCOVERY.md.

### Tech Stack Selection

See `C:\ClaudeCodeProjects\TECH_STANDARDS.md` for full framework.

Summary: No default stack. Arch chooses at Sprint 0. Python projects: see `C:\ClaudeCodeProjects\PYTHON_STANDARDS.md`.

### Testing Standards

**Layer 1 — Unit tests**: in-memory DB or test doubles, external services mocked, no network required.

**Layer 2 — Functional tests**: real DB, real service started fresh, real requests.
- CAN mock: external AI APIs, third-party webhooks
- CANNOT mock: database, filesystem, the service itself, auth flow
- Covers: happy path + at least one error path per endpoint/command
- **Emit-consumer pairing** (see also Backend Dev role): for every event produced, at least one test verifies the consumer acts on it

**Test must pass before**: marking any Story Done, Sprint Demo, any commit to main.

### Performance Standards

| Metric | Target | Verification |
|---|---|---|
| Health check | < 100ms | Timing at Integration step 1 |
| Simple operation | < 500ms | Functional test timing |
| Complex operation | < 2000ms | Functional test timing |
| Initial load | < 3s | Chrome DevTools `performance_start_trace` |
| Bundle size | No chunk > 500KB | Chrome DevTools `list_network_requests` |
| Runtime errors | 0 uncaught | Browser console after each flow |

These are defaults. Override per `TECH_SPEC.md §performance-targets` when the project requires different values.

### Git Strategy

Determined at Sprint 0 Decision Checklist, recorded in `TECH_SPEC.md §git`.

**Strategies**:
- **Strategy A (auto)**: commit after each Story Done + each verified bug fix. Continuous integration. Default for new projects.
- **Strategy B (Sprint-end)**: commit only at Sprint Demo accepted. All work stays local until demo passes. Default for existing/deployed projects.
- **Strategy C (manual)**: developer decides commit timing. Use only when A/B don't fit (e.g. experiment branches).

```
<type>(<scope>): <description>
Types: feat | fix | test | devops | docs | refactor | style | spike
```

**Commit trigger points** (only if strategy permits):
- Sprint 0 complete — after CP2
- Each Spike Done
- Each Story Done — strategy A only
- Each bug fix verified — strategy A only
- Sprint Demo accepted — always

---

## Guardrails

**Spec Drift**: code deviates from the interface contract or schema doc. **All deviations require Arch awareness** — no developer may self-classify and silently fix.
- **Small deviation** (field name, order, minor type): Backend fixes code immediately + **logs the deviation and fix to the Story's Notes field**. Arch confirms the fix at Code Review (Integration step 3).
- **Medium/Large deviation** (structure change, missing endpoint, wrong behavior): Arch decides — fix code OR update contract. After decision: Arch implements or directs fix, SM broadcasts updated contract to all roles. Never proceed to Integration with mismatched contracts.

**Definition of Done (Story Level)**: see Definition of Done in Sprint Review + Demo section. All ACs (functional + UX) must be verified against the running product and QA three-layer verification must be complete before a Story is marked Done.

**No Shortcuts:**
- Never mock real dependencies in functional tests
- Never skip QA verification checklist
- Never mark Done without evidence
- Never use a test input that cannot activate the target code path
- Never commit code that breaks an existing passing test
- Never assume a service is healthy — verify with fresh start script (see Start Script Lifecycle)
- Never use fake test data to substitute for real user-supplied data

**Autonomous Bug Fixing — 3-tier error budget**:

| Tier | Condition | Action |
|------|-----------|--------|
| **L1 Auto-fix** | Subagent returned malformed output (wrong JSON schema, missing required field) | Relaunch subagent with corrected prompt. Max 1 retry. No log entry required. |
| **L2 Record + Continue** | Tool call failed (network timeout, file not found, non-critical test step failed) | Log to `tasks/errors.md` with timestamp + step + error. Continue to next step. |
| **L3 Stop + Escalate** | Service won't start, health check fails, Blocker bug found, fundamental design issue | Stop current Integration. Fix root cause → re-run start script → re-run test scripts → QA subagent re-verify → update verdict. Escalate to user only if architectural pivot required. |

**Verification Enforcement (absolute)**:
- A Story is NOT Done until QA subagent has produced a verdict referencing that Story — hook checks evidence directory exists
- A Sprint is NOT complete until `docs/qa/sprintN-verdict.md` = PASS AND `docs/ux/sprintN-review.md` exists — hook enforced
- QA verdict content is authored by QA subagent, NOT by main agent — main agent writes the file from QA subagent's structured output only
- UX review content is authored by UX subagent, NOT by main agent — main agent writes the file from UX subagent's structured output only
- Test runner script reads from the test config file — project-specific, no hardcoded selectors
- If Playwright is unavailable: STOP and notify user — see Playwright availability rule in Project Scope. No curl fallback, no degraded verification.

---

## Lessons Learned

`tasks/lessons.md` updated by SM at every Sprint Retrospective. **Keep entries concise — one lesson, one line conclusion. Verbose entries defeat the purpose.**

```markdown
# Lessons Learned
## Sprint N — <YYYY-MM-DD>
### What worked
- [one line: what + why it worked]
### What failed
- [one line: what failed] → Root cause: [one line] → Fix applied: [one line]
### Rule updates made
- [CLAUDE.md section updated + reason]
```

**Pruning rule** (enforced as gate): Before adding new entries, SM checks: if file exceeds 80 lines, prune entries older than 3 Sprints that have been converted to CLAUDE.md rules or resolved. `tasks/lessons.md` must never exceed 100 lines — lines above 100 are considered truncated by convention.
