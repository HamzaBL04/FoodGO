# GitHub Copilot — Repository Instructions

GitHub Copilot reads this file automatically for Chat and code suggestions in this repository.

**The single source of truth for FoodGO is [`/AI_CONTEXT.md`](../AI_CONTEXT.md).** Read it and follow it: it describes the project, stack, folder layout, conventions and glossary.

Quick rules (full list in `AI_CONTEXT.md`):

- Respect the layers: routes → one component → repositories (only repositories write SQL). Only `orderManagement` changes order status, via `OrderState.transition()`.
- Restaurant-owned data always takes `restaurantId` as a required argument; never infer scope from the session alone.
- Throw `AppError` with a specification code; money is integer millimes.
- Do not invent business rules marked UNRESOLVED (cancellation, refunds, failed delivery…). Leave a `TODO:` instead.
- Match the existing style and `.editorconfig`; do not reformat unrelated code. Escape UI output with `esc()`.
- Never hardcode secrets; use `.env` (gitignored) and document variables in `.env.example`.
- No new dependency without a note in the PR. New features include tests that name the requirement IDs.
- Update `docs/CHANGELOG.md` when behaviour changes.

When this file and `AI_CONTEXT.md` disagree, `AI_CONTEXT.md` wins — update both.
