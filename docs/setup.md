# Full Setup Guide

Everything a new teammate (or the grader) needs to run FoodGO from scratch. Tested by cloning into an empty folder and following it.

## Prerequisites

- **Git**
- **Node.js 22.14 or newer** (`node -v`). npm comes with it. No C++ compiler or Python needed.
- No database server: FoodGO uses a local SQLite file.
- A code editor with an AI assistant (VS Code + GitHub Copilot or Claude recommended; the repo suggests extensions on open).
- Optional, for maintainers only: Playwright + ffmpeg (re-recording the demo video), Mermaid CLI (re-rendering diagrams).

## Steps

```bash
# 1. Clone
git clone https://github.com/HamzaBL04/foodGO.git
cd foodGO

# 2. One-time project setup (enables the git hooks)
./scripts/setup.sh            # Windows: run in Git Bash, or: bash scripts/setup.sh

# 3. Environment variables (optional — every value has a default)
cp .env.example .env

# 4. Install dependencies
npm install

# 5. Database: nothing to do. The first start creates data/foodgo.db with demo data.
#    Reset it any time with:
npm run seed

# 6. Run
npm start                     # http://localhost:3000   (npm run dev restarts on changes)

# 7. Run tests and lint
npm test
npm run coverage              # what CI runs: tests + 60 % line-coverage gate
npm run lint
```

Demo accounts are listed in the [README](../README.md#demo-credentials). API docs: http://localhost:3000/api/docs.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `FOODGO_DB` | `data/foodgo.db` | SQLite file |
| `TZ` | `Africa/Tunis` | Time zone of the ordering deadline |
| `FOODGO_DEMO_MODE` | `true`, `false` when `NODE_ENV=production` | Show the customer's SMS code on screen (no real SMS provider yet) |
| `NODE_ENV` | `development` | `production` makes the session cookie `Secure` and turns demo mode off |
| `ANTHROPIC_API_KEY` | empty | Enables the Claude-written note on the Prep forecast |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Model for that note |

`.env` is read by `npm start`, `npm run dev` and `npm run seed` (`node --env-file-if-exists`). It is gitignored: `git status` must never list it.

## Troubleshooting

- **Problem:** `npm install` fails with `gyp ERR!` or asks for Python / Visual Studio.
  **Fix:** check `node -v` ≥ 22.14 and that the repo's `.npmrc` is present (it skips the native build and uses prebuilt binaries — ADR-0006). On an unusual platform without prebuilds: install build tools, then `npm rebuild better-sqlite3`.
- **Problem:** `Error: listen EADDRINUSE :::3000`.
  **Fix:** another app uses the port. Set `PORT=3001` in `.env`, or `PORT=3001 npm start` (PowerShell: `$env:PORT=3001; npm start`).
- **Problem:** `./scripts/setup.sh: Permission denied`.
  **Fix:** `chmod +x scripts/*.sh` or run `bash scripts/setup.sh`.
- **Problem:** Ordering at Kram Snack says "closed for today".
  **Fix:** expected after 10:30 — that is the deadline rule (BR-01). Use Dar Lella (deadline 23:30 in the demo data) or change the deadline in the restaurant's Settings.
- **Problem:** The customer sign-in code never arrives by SMS.
  **Fix:** expected — no SMS provider is integrated. In demo mode the code is shown on screen. In production mode (`NODE_ENV=production`) customers cannot sign in until a real SMS adapter is added.
- **Problem:** The docs reminder never appears when pushing.
  **Fix:** run `./scripts/setup.sh` once (it points git at `.githooks/`). It only prints when a push changes code but no docs.
