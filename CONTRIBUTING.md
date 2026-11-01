# Contributing & Team Workflow

How the FoodGO team works on this repo. Everyone follows the same rules so nobody breaks `main`. Read it once, keep it handy.

## 1. Golden rules

1. **Never commit directly to `main`.** `main` always works and is branch-protected.
2. **One feature = one branch = one Pull Request (PR).**
3. **At least one teammate reviews** every PR before it merges.
4. **CI must pass** (green check: lint + tests + coverage on Node 22 and 24).
5. **Never commit secrets** (`.env`, API keys). They belong in `.env` only.
6. **Don't invent business rules.** If the spec marks something UNRESOLVED, ask the team or leave a `TODO(name):`.

## 2. First-time setup

```bash
git clone https://github.com/HamzaBL04/foodGO.git
cd foodGO
./scripts/setup.sh        # enables the git hooks (Windows: run in Git Bash)
cp .env.example .env       # local settings, never committed
npm install
npm start                  # http://localhost:3000
```

Details and troubleshooting: [docs/setup.md](docs/setup.md).

## 3. Branch naming

```
feat/<short-name>      a new feature          e.g. feat/order-cancellation
fix/<short-name>       a bug fix              e.g. fix/deadline-boundary
docs/<short-name>      documentation          e.g. docs/architecture
refactor/<short-name>  no behaviour change    e.g. refactor/shared-auditor
chore/<short-name>     tooling / config       e.g. chore/lab6-environment
```

## 4. Daily flow

```bash
git checkout main
git pull                          # everyone's latest work
git checkout -b feat/my-thing     # fresh branch

# ... work, commit as you go ...
npm run lint && npm test          # before pushing

git push -u origin feat/my-thing  # the pre-push hook prints a docs reminder if needed
# open a Pull Request on GitHub, fill in the template, ask a teammate to review
```

## 5. Commit messages

A light version of [Conventional Commits](https://www.conventionalcommits.org):

```
feat: refuse orders after the restaurant deadline (BR-01)
fix: count an order at exactly the deadline as late (U-8)
docs: add ADR for the SQLite choice
refactor: share one audit helper between components
test: cover cross-restaurant access (BR-09)
chore: add the starter-template git hooks
```

One logical change per commit. If AI helped, add a `Co-Authored-By:` trailer (for example `Co-Authored-By: Claude <noreply@anthropic.com>`).

## 6. Pull Requests

- Fill in the PR template (it appears automatically), including requirement IDs and "AI assistance used".
- Link the issue it closes, if any (`Closes #12`). Use the issue templates for features and bugs.
- Keep PRs small. If you changed behaviour, update `docs/CHANGELOG.md` **in the same PR**; if you changed a route, update `docs/api/openapi.yaml`.
- Notable design choice → add an ADR in `docs/decisions/` (copy `TEMPLATE.md`).
- The reviewer checks: does it follow `AI_CONTEXT.md`? Is it tested? Does it only do what it says? Is the restaurant scope enforced?

## 7. Using AI assistants responsibly

AI tools (Copilot, Claude, Cursor) are encouraged in this AI-first course, but **you own every line you commit**:

- Read and understand AI-generated code before committing it. You will be asked to explain your PRs at the defence.
- Keep `AI_CONTEXT.md` current so suggestions fit FoodGO.
- Never paste secrets, credentials or real customer data into an AI chat; use the demo data.
- Review a large AI-written change like a teammate's PR. Record significant AI use in `docs/ai/AI_USAGE_LOG.md`.

## 8. Keeping docs alive

- Behaviour changed → line in `docs/CHANGELOG.md`.
- Real decision → ADR in `docs/decisions/`.
- Moved or added folders → `./scripts/update-structure.sh` (refreshes the README tree).
- Requirement implemented → cite its ID in code and test titles, then `npm run traceability`.

The pre-push hook and a CI job remind you when you change code without touching docs. They only warn; they never block.

## 9. Resolving disagreements

Discuss in the team chat first. If still split, the owner of that area decides (Product Owner for requirements, implementer for code) and we note it in an ADR to revisit later. Stakeholder questions (UNRESOLVED items) are never settled by one of us alone.
