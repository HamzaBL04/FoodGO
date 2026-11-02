# 3. Adopt the CS 488 starter template into the existing repository

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Lab 6 asks teams to create their repository from the course `project-starter-template`. Our repository `HamzaBL04/foodGO` already existed: the midterm MVP had been built in it through 12 pull requests, and the commit/PR history is part of what the midterm is graded on. Re-creating the repository from the template would have discarded that history.

## Decision

Bring the template's contents into `foodGO` in one pull request instead of starting a new repository. Template files are adopted as they are where we had nothing (scripts, git hooks, issue templates, ADR folder, `AI_CONTEXT.md` and the per-tool AI configs). Where we already had something stronger, we keep ours and merge in the template's ideas:
- **CI:** keep our lint + coverage gate on Node 22/24 and add the template's docs-reminder job (the template's CI uses Node 20, which our SQLite driver no longer supports).
- **`.gitignore` / `.editorconfig`:** template secrets/editor rules + our project lines.
- **README:** keep our content, add the template's Getting started, structure tree and team workflow sections.
- **Stack appendix:** `node.md` applied (npm scripts, `node --test`, ESLint, test command in CI) and the `stack-appendices/` folder not committed.

## Consequences

- The full development history is preserved alongside the Lab 6 workspace conventions.
- The template's "create from template" step is replaced by this documented merge; the Setup Report says so.
- Future changes follow the template workflow (protected `main`, PR + review, docs reminders).
