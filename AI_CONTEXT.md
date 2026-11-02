# AI Context — Single Source of Truth

> This is the one place we describe FoodGO *to AI assistants* (GitHub Copilot,
> Claude, Cursor, Gemini…). `CLAUDE.md`, `.github/copilot-instructions.md`,
> `.cursor/rules/project.mdc` and `.cursorrules` all point here.
> Keep it short, current and honest. Update it in the same PR as the change it describes.

---

## 1. Project summary

**Name:** FoodGO
**One-liner:** A pre-order lunch platform **only for Lac 3 / Zone Industrielle Le Kram** (Tunis; one area, two names): employees order before a restaurant-set morning deadline, and the restaurant's **own** delivery staff deliver at lunch.
**Why it exists:** traffic in that area gets heavy at lunchtime because employees leave work at the same time to get food. Pre-ordering keeps them at their desks (team decision, [ADR-0007](docs/decisions/0007-service-area-lac3-zi-kram.md)).
**Service area (FR-32, BR-17):** every restaurant and every workplace has a zone; there is exactly one, `LAC3_ZI_KRAM`. The list lives only in `src/domain/serviceArea.js` (plus the CHECK in migration 003). An order is refused unless both the restaurant and the workplace are inside the area. Restaurants outside the area cannot join FoodGO (BR-18, team decision).
**Primary users:** employees of companies in the area, restaurant staff there, the restaurant's delivery people, the platform administrator.
**The AI-assisted component:** the restaurant **Prep forecast** (FR-31, PROPOSED): a weekday-weighted moving average of past orders, with a backtest of its own error, plus an *optional* Claude-written prep note when `ANTHROPIC_API_KEY` is set. It is **advice only**: it never accepts or refuses orders, changes payments, eligibility or the menu, and the prompt never contains customer data.

Design sources (read these before designing anything new):
- Requirements (Lab 3): `docs/lab3-specification/` — FR-01…FR-30, BR-01…BR-16, open questions Q-01…Q-37. Added since: FR-31 (AI forecast, ADR-0004), FR-32 + BR-17 (service area, ADR-0007). Where Lab 3/4 say "offices and campuses", read "workplaces in Lac 3 / Zone Industrielle Le Kram".
- Design (Lab 4 SDD, IEEE 1016): `docs/lab4-sdd/` — decisions D-01…D-12, integrity rules I-1…I-11, transactions T1–T3, use cases UC-01…UC-14
- Living architecture summary: [`docs/architecture.md`](docs/architecture.md) · Decisions: [`docs/decisions/`](docs/decisions/)
- Backlog and NFRs: `docs/requirements/BACKLOG.md` · Traceability: `docs/requirements/TRACEABILITY.md`

## 2. Tech stack

| Layer       | Choice |
|-------------|--------|
| Language    | JavaScript, Node.js **22.14+** (CommonJS on the server, ES modules in the browser) |
| Framework   | Express **5** (REST JSON API under `/api/v1`, Server-Sent Events at `/api/v1/events`) |
| Frontend    | Plain HTML + CSS + ES modules in `src/public` — **no framework, no build step** |
| Database    | SQLite via `better-sqlite3` 13 (synchronous; prebuilt binaries, `.npmrc` has `ignore-scripts=true`) |
| Validation  | `zod` 4 schemas in `src/api/schemas.js` |
| Security    | `helmet`, `express-rate-limit` on `/auth`, `bcryptjs`, SHA-256-hashed session tokens, httpOnly cookie or Bearer |
| Package mgr | npm (lockfile committed; use `npm ci` in CI) |
| Testing     | `node:test` + `supertest`, coverage with `c8` (gate ≥ 60 % lines over `src/`, browser files excluded) |
| Lint        | ESLint 9 flat config (`eslint.config.js`), `.editorconfig` |
| CI          | GitHub Actions `.github/workflows/ci.yml`: lint + coverage on Node 22 and 24, docs reminder |
| API docs    | OpenAPI 3.0.3 `docs/api/openapi.yaml`, Swagger UI at `/api/docs` |
| Deploy      | none yet (any Node 22.14+ host with a persistent disk) |

## 3. Project structure

- `src/server.js` — start-up (seeds demo data on first run) · `src/app.js` — Express app · `src/context.js` — composition root (wires everything)
- `src/api/` — **presentation layer**: `routes/*Routes.js`, `middleware.js` (authenticate, `requireRole`, `requireRestaurantScope`, `validate`), `schemas.js`, `errorHandler.js`
- `src/components/` — **business logic**, one per spec module: `auth`, `customerComponent`, `restaurantManagement`, `orderManagement`, `deliveryManagement`, `paymentComponent`, `notificationComponent`, `forecastComponent`, `admin`, plus `presenters.js`, `audit.js`
- `src/domain/` — pure rules: `orderState.js` (table-driven state machine, a State-pattern variant), `deadline.js`, `money.js`, `forecast.js`, `errors.js`, `ids.js`, `clock.js`
- `src/repositories/` — **data access**, the only place with SQL; `unitOfWork()` for transactions
- `src/adapters/` — third-party boundaries: payment (sandbox), SMS/OTP (sandbox), notifications, LLM (Anthropic)
- `src/db/` — `schema.sql`, `migrations/NNN_*.sql`, `seedData.js`, `seed.js`
- `src/public/` — the four UIs: `customer.html`, `restaurant.html`, `delivery.html`, `admin.html` + `js/`, `css/`, `fonts/`
- `test/unit/`, `test/integration/` — `test/helpers.js` gives `createTestApp()` (in-memory DB, fixed clock: Mon 2 Nov 2026 08:00 Tunis)
- `docs/` — specs, SDD, UML, ADRs, guides · `scripts/` — setup, docs check, structure tree, traceability, metrics, benchmark · `demo/` — demo video + recorder

**Commands:** `npm install` · `npm start` (port 3000, reads `.env` if present) · `npm run dev` · `npm test` · `npm run coverage` · `npm run lint` · `npm run seed` (reset demo DB) · `npm run traceability` · `npm run metrics` · `npm run benchmark`.

## 4. Conventions the assistant MUST follow

- **Layers (SDD §2.4):** routes contain no business rules (validate → call **one** component → respond). Only repositories issue SQL. Only `orderManagement` creates orders or changes order status, and always through `OrderState.transition()`. Third-party calls only through `src/adapters`.
- **Restaurant scope (D-10, BR-09):** every repository method touching restaurant-owned data takes `restaurantId` as a required argument. Staff URLs carry `/restaurants/:restaurantId/…` and `requireRestaurantScope` checks it against the session. Never infer scope from the session alone.
- **Transactions:** multi-row writes go inside `repos.unitOfWork()`. Events are published **after** commit (D-08), never inside.
- **Errors:** throw `AppError` with a specification code (`AUTH-001`, `AUTH-002`, `VAL-001`, `ORDER-001`, `ORDER-002`, `ORDER-003`, `PAY-001`, `PAY-002`, `DEL-001`, `NOT-FOUND`, `SYS-001`). Never leak stack traces or SQL.
- **Money:** integer **millimes** (1 TND = 1000) in the database and calculations; TND numbers with 3 decimals only in API views.
- **Naming:** camelCase JS, PascalCase classes, snake_case SQL, `UPPER_SNAKE` constants, files camelCase. Commit prefixes `feat: fix: docs: refactor: test: chore: ci:`.
- **Comments:** explain *why*; cite requirement IDs (FR-xx, BR-xx, UC-xx, D-xx, I-x) where code implements them — `npm run traceability` reads them.
- **Tests:** every feature ships with unit and/or integration tests; name the requirement in the test title. Use `createTestApp()` and the fixed clock; never real time or a real DB file.
- **Frontend:** escape all server data with `esc()` from `src/public/js/api.js`; no inline event handlers (CSP); no new UI framework.
- **Dependencies:** none added without the team agreeing and a note in the PR. Prefer Node's standard library.
- **Secrets:** never hardcode keys. Use `.env` (gitignored); document new variables in `.env.example` and `docs/setup.md`.
- **Docs:** behaviour change → `docs/CHANGELOG.md`; real decision → new ADR in `docs/decisions/`; new route → `docs/api/openapi.yaml`.
- **Workflow:** branch → PR (template) → green CI → teammate review → merge. Disclose AI help with a `Co-Authored-By:` trailer and the PR's "AI assistance used" section.

## 5. What NOT to do

- **Don't invent business rules.** Anything marked UNRESOLVED in the spec/SDD stays out: order cancellation, restaurant rejection, failed delivery, refunds, delivery fees, GPS tracking, self-registration, a specific real payment provider (Q-04…Q-37). If you need a position to make code run, mark it PROPOSED with a reason, or leave a `TODO(name):`. The service-area open points (staggered delivery windows, how to measure traffic) are also undecided (ADR-0007).
- **Don't add a zone or serve a new area** without a new ADR. Server code reads the zone list only from `src/domain/serviceArea.js`; the only other copies are the CHECK in migration 003 and the two `<select>`s in `admin.html` / `restaurant.html` — change them together.
- Don't let the AI forecast (or any AI) decide orders, payments, eligibility or menu changes.
- Don't add platform-employed delivery staff or delivery equipment (BR-06, BR-07).
- Don't weaken scope checks, rate limits, CSP or the coverage gate to make something pass.
- Don't commit `.env`, `data/*.db`, `node_modules/`, `coverage/`, `demo/raw/`.
- Don't paste real customer data or credentials into AI chats; demo data only.

## 6. Glossary / domain terms

- **Pre-order** — an order placed before the restaurant's ordering deadline, for today's lunch service.
- **Ordering deadline** — restaurant-local `HH:MM` after which orders are refused (BR-01). An order at exactly the deadline is refused (U-8).
- **Deadline snapshot** — the deadline in force when an order was placed, stored on the order (D-04).
- **Service date** — the local calendar day an order is for.
- **Membership / RestaurantCustomer** — the record that a restaurant registered a customer; holds `eligible` and the credential reference (D-01). A customer only sees restaurants with an active, eligible membership.
- **Organization** — the customer's workplace (an office, factory, or a school in the area); a restaurant may restrict itself to some (BR-04). Has a service zone.
- **Service area / zone** — Lac 3 / Zone Industrielle Le Kram (`LAC3_ZI_KRAM`): one area known by both names, the only place FoodGO operates (FR-32, BR-17).
- **In-person registration** — the only way to become a customer; staff must confirm the identity check (BR-05).
- **Assignment** — link between an order and one of the restaurant's own delivery people: ASSIGNED → STARTED → COMPLETED (BR-10, BR-11).
- **Order status** — SUBMITTED → IN_PREPARATION → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED (PROPOSED happy path).
- **Payment projection** — `orders.payment_status` copies the current `payment` row; only Payment writes it (D-03).
- **Millimes** — 1/1000 of a Tunisian dinar (TND).
- **Sandbox adapter** — stand-in for an unselected provider (payment, SMS); demo mode shows the SMS code on screen.
- **PROPOSED / UNRESOLVED** — the spec's markers: a design position we took to make it buildable / a business decision reserved to stakeholders.

---

_Last updated: 1 Nov 2026 by Hamza Ben Labiedh (with Claude). Review at the start of every work session._
