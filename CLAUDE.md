# CLAUDE.md

Context for Claude (Claude Code, the Claude app, the Claude VS Code extension) in this repository.

**Read [`AI_CONTEXT.md`](AI_CONTEXT.md) first — it is the single source of truth** for the project summary, stack, structure, conventions and glossary. This file only adds Claude-specific working notes.

## How to work in this repo

- Follow every rule in `AI_CONTEXT.md`, especially the layer rules, the required restaurant scope, and "don't invent business rules".
- Before changing behaviour, skim `docs/architecture.md`, the newest ADRs in `docs/decisions/`, and the relevant SDD section in `docs/lab4-sdd/`.
- Work on a branch, open a PR using the template, wait for green CI. Never push to `main`.
- When behaviour changes: update `docs/CHANGELOG.md`, `docs/api/openapi.yaml` (if a route changed), and re-run `npm run traceability`.
- Run the tests and lint before saying something works, and report the real output.
- End commit messages with a `Co-Authored-By: Claude …` trailer, and fill in the PR's "AI assistance used" section.

## Useful commands

```bash
npm install            # no compiler needed (.npmrc ignore-scripts; prebuilt SQLite)
npm start              # http://localhost:3000, reads .env if present, seeds demo data on first run
npm run dev            # restart on change
npm test               # all tests (fixed clock, in-memory DB)
npm run coverage       # tests + 60 % line gate over src/ (what CI runs)
npm run lint           # ESLint
npm run seed           # reset the demo database
npm run traceability   # regenerate docs/requirements/TRACEABILITY.md
./scripts/update-structure.sh   # refresh the README structure tree
```

## Project-specific guidance

- Demo accounts are in the README; demo mode returns the SMS code in `/auth/otp/request` (off when `NODE_ENV=production`).
- Tests that depend on the deadline use `createTestApp({ at: '…' })`; Campus Bites closes at 10:30, Dar Lella at 23:30.
- New order states need a stakeholder decision first — do not add CANCELLED/REJECTED/FAILED on your own.
- Keep the AI forecast advisory and free of customer data (there is a test for the prompt).
