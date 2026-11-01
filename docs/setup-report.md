# Lab 6 — Setup Report

**Project:** FoodGO — pre-order food delivery for Tunisian offices and campuses
**Course:** CS 488 AI-First Software Engineering, Fall 2026 · **Date:** 1 Nov 2026

## Repository and members

- **Repo:** https://github.com/HamzaBL04/foodGO (private; the instructor is invited as a collaborator)

| Member | GitHub username | Collaborator | First PR merged |
|---|---|---|---|
| Hamza Ben Labiedh | `HamzaBL04` (owner) | yes | yes — PRs #1–#13 |
| Ali Chamakh | _TODO_ | _TODO_ | _TODO (intro PR, 2 Nov)_ |
| Mohamed Krid | _TODO_ | _TODO_ | _TODO (intro PR, 2 Nov)_ |

## How the template was applied

Our repository already existed when Lab 6 started: the midterm MVP had been built in it through 12 pull requests. Re-creating the repository from the starter template would have erased that history, so we brought the template **into** the existing repository in one pull request ([ADR-0003](decisions/0003-adopt-starter-template-in-existing-repo.md)):

- **Adopted from the template:** `AI_CONTEXT.md`; `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/project.mdc` and `.cursorrules` all pointing to it; `CONTRIBUTING.md`; PR and issue templates; `scripts/setup.sh`, `check-docs.sh`, `update-structure.sh`; `.githooks/pre-push`; `.env.example`; `.vscode/` recommendations; `docs/architecture.md`, `docs/setup.md`, `docs/decisions/` (ADR template + ADR-0001), `docs/CHANGELOG.md`; `LICENSE` (MIT).
- **Merged with what we had:** CI keeps our lint + coverage gate on Node 22/24 and adds the template's docs-reminder job (the template's Node 20 cannot run our SQLite driver); `.gitignore` combines the template's secrets/editor rules with ours; the README gained the template's Getting started, structure tree, documentation and team-workflow sections.
- **Stack appendix (node.md):** applied — npm project, ESLint, `node --test`, `npm test` run in CI; `.env` is loaded by `npm start` / `npm run dev` / `npm run seed`. The `stack-appendices/` folder was not committed.
- **Improvement to the template:** `update-structure.sh` now lists only git-tracked files, so `node_modules`, `.env` and local databases never appear in the README tree (the original `find` fallback listed them when `tree` is not installed).

## Stack

**Node.js 22.14+, Express 5, SQLite (better-sqlite3), plain HTML + ES modules, node:test + supertest + c8, ESLint, GitHub Actions.** One-line reason: it installs and runs with a single `npm install && npm start` on any machine, and SQLite's synchronous transactions make the SDD's all-or-nothing operations simple ([ADR-0002](decisions/0002-node-express-sqlite-stack.md)). Other decisions recorded: [0004 advisory AI forecast](decisions/0004-advisory-ai-demand-forecast.md), [0005 Mermaid for UML](decisions/0005-mermaid-for-uml.md), [0006 prebuilt SQLite, no compiler](decisions/0006-prebuilt-sqlite-no-compiler.md).

## Evidence

| Check | Result |
|---|---|
| Clone test (fresh folder, README only) | ✅ `git clone` → `./scripts/setup.sh` (hooks enabled) → `cp .env.example .env` → `git status` does **not** list `.env` → `npm install` (no compiler) → `npm start` serves the app on the port set in `.env`; `/api/docs` returns 200 |
| Tests / lint on the branch | ✅ 119 tests pass, coverage 97.3 % of server code, 0 lint problems |
| CI on the Lab 6 PR | ✅ green (Node 22, Node 24, docs reminder) |
| Merged PR screenshot | ![Merged PR](images/merged-pr.png) — _TODO: add screenshot_ |
| Green CI run screenshot | ![CI run](images/ci-green.png) — _TODO: add screenshot_ |

## AI assistants

We configured one context file, [`AI_CONTEXT.md`](../AI_CONTEXT.md), and pointed every tool at it: Claude through `CLAUDE.md` (which adds the npm commands and project-specific warnings), GitHub Copilot through `.github/copilot-instructions.md`, and Cursor through `.cursor/rules/project.mdc` and `.cursorrules`. The file states the stack with versions, the layer rules from our SDD (routes → one component → repositories; only Order Management changes order status; the restaurant scope is a required argument), the error codes, money in millimes, the test conventions, a glossary of our domain terms (deadline snapshot, membership, assignment…), and a "What NOT to do" list that forbids inventing business rules the specification leaves UNRESOLVED.

**Concrete example.** We tested it with a fresh Claude agent that knew nothing about the project and read only `AI_CONTEXT.md` and `CLAUDE.md` ([full record](ai/ai-context-verification.md)). Asked where to add a "ready for pickup" step, it named the exact files in the right layers (`orderState.js`, `orderManagement.js`, `restaurantOrderRoutes`), required `OrderState.transition()`, `unitOfWork`, events after commit, the restaurant scope, `createTestApp()` tests and CHANGELOG/OpenAPI updates. It also noticed that a new status is a business decision needing an ADR. Asked to "add order cancellation", it **declined to invent the rule**: it quoted our open questions (Q-04, Q-05…), listed what stakeholders must decide (cut-off, refunds, notifications) and offered to draft them. A generic assistant would have written the endpoint.

## Branch protection

`main` is protected: pull request required, **1 approving review required**, status checks (both CI jobs) must pass, and the rules apply to administrators too. From now on nobody, including the owner, can merge without a teammate's approval. _If the GitHub plan does not allow protection on a private repository, see TODO 3._

## Still TODO before implementation continues

1. **Ali and Mohamed** (team meeting, 2 Nov): accept the collaborator invitation, clone, run `./scripts/setup.sh`, then each open an intro PR adding their GitHub username to this report and the README team list; Hamza reviews theirs, they review each other's. Fill in the members table above.
2. Add the two screenshots to `docs/images/` (a merged PR page and the green Actions run).
3. Confirm branch protection is active on GitHub (Settings → Branches). Free accounts can only protect **public** repositories; the options are GitHub Pro (free with the GitHub Student Developer Pack) or making the repository public.
4. Invite the instructor (`aziz.souiai@musteducation.tn`) as a collaborator.
5. Team code walkthrough so every member can explain the Sprint 1 code before the defence.

## Honest notes

Sprint 1 (the MVP) and this setup were done by one member working with Claude; the other two members were not yet involved, which is why TODO 1 matters. The PRs before this one were merged without a second reviewer; with branch protection on, every future PR needs one.
