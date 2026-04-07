---
name: project
description: Full-stack project generation workflow. This skill should be used when the user says "new project", "start a project", "build an app", or invokes /project with a project description.
disable-model-invocation: true
argument-hint: "[--auto] <project description in any language>"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, EnterPlanMode, ExitPlanMode, WebSearch, WebFetch]
---

# Project Factory

## Step 1 — Load the workflow

Read `C:\ClaudeCodeProjects\CLAUDE.md` in full. That file is the single source of truth for all phases, standards, and rules.

## Step 2 — Parse mode

Check if `$ARGUMENTS` contains `--auto`:

- `--auto` present → **Autonomous mode**: Activate the Virtual User role. Record `acceptance_mode: auto` in `docs/TECH_SPEC.md §acceptance`. Iterate Sprints until Virtual User verdict = ACCEPTED (score >= 8/10). Do NOT stop for user verification between Sprints.
- `--auto` absent → **Manual mode** (default): User verifies each Sprint Demo. Virtual User role is NOT activated. Record `acceptance_mode: manual` in `docs/TECH_SPEC.md §acceptance`.

Strip `--auto` from arguments before passing to Step 3.

## Step 3 — Execute

Follow the workflow defined in CLAUDE.md exactly, starting from Phase 0 (Discovery) for new projects.

The project request is:

$ARGUMENTS
