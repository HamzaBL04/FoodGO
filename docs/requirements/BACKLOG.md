# FoodGO — Prioritised product backlog and non-functional requirements

Requirements artifact for the CS 488 midterm. Source of truth: the Lab 3 specification (`docs/lab3-specification`). Every story carries the requirement IDs it implements, so it traces to the spec, the SDD (`docs/lab4-sdd`) and the code (`docs/requirements/TRACEABILITY.md`).

- **Priority:** MoSCoW. **Estimate:** story points (Fibonacci), estimated by the team with AI-suggested first values then corrected.
- **Status:** ✅ Done in the midterm MVP · 🔜 Planned for a later sprint · ⛔ Blocked on a stakeholder decision (spec §19.7).

## Epics

| Epic | Stories | FRs |
|---|---|---|
| E1 Accounts & access | US-01 – US-05 | FR-01–FR-04, FR-29, FR-30, BR-05, BR-16 |
| E2 Restaurant & menu | US-06 – US-09 | FR-05–FR-08, FR-12–FR-13 settings, BR-03 |
| E3 Ordering | US-10 – US-13 | FR-09–FR-15, BR-01, BR-02, BR-12 |
| E4 Verification | US-14 – US-15 | FR-16, FR-17, BR-04, BR-15 |
| E5 Delivery | US-16 – US-20 | FR-18–FR-24, BR-06–BR-11 |
| E6 Payment | US-21 – US-23 | FR-25–FR-28, BR-12, BR-13 |
| E7 AI-assisted planning | US-24 | FR-31 (PROPOSED), BG-03, BG-04 |
| E8 Platform quality | US-25 – US-28 | NFRs below |

## User stories

Sorted by priority: Must first, then Should, then Could; within a priority, by dependency order (story ID).

| Rank | ID | User story | Acceptance criteria (spec §17) | Req. | MoSCoW | SP | Status |
|---|---|---|---|---|---|---|---|
| 1 | US-01 | As **restaurant staff** I want to register a customer in person so that only people I verified can order from me. | Name, phone, organization captured; staff must tick "identity checked"; duplicate registration refused; customer receives an SMS. | FR-01–FR-04, BR-05, BR-16 | Must | 5 | ✅ |
| 2 | US-02 | As a **customer** I want to sign in with my phone number and a one-time code so that I don't need a password. | Code sent by SMS (sandbox); single use; expires after 5 min; 5 wrong attempts lock the code; unregistered numbers refused. | FR-01, FR-03, BR-05 | Must | 5 | ✅ |
| 3 | US-03 | As **restaurant staff / delivery person / admin** I want to sign in with a password. | bcrypt hashes only; same answer for unknown identity and wrong password; session expires after 12 h. | FR-29, FR-30, §12 | Must | 3 | ✅ |
| 4 | US-04 | As the **platform administrator** I want to create restaurants and provision their staff accounts. | Staff account bound to exactly one restaurant; duplicate identity refused; admins cannot be created from the app. | FR-29 | Must | 3 | ✅ |
| 5 | US-05 | As **restaurant staff** I want to create accounts for my own delivery team. | Account bound to my restaurant; never visible to other restaurants. | FR-30, FR-18, BR-06 | Must | 2 | ✅ |
| 6 | US-06 | As a **customer** I want to see only the restaurants that registered me. | Unregistered or ineligible restaurants are not listed and not reachable. | FR-05, BR-04, BR-16 | Must | 2 | ✅ |
| 7 | US-07 | As a **customer** I want to browse a menu and see which dishes are available today. | Unavailable dishes are shown but cannot be added. | FR-06, FR-08, BR-02 | Must | 2 | ✅ |
| 8 | US-08 | As **restaurant staff** I want to add, edit, remove dishes and toggle availability. | Price change never alters placed orders (D-02); removal is soft. | FR-07, FR-08, BR-03 | Must | 3 | ✅ |
| 9 | US-09 | As **restaurant staff** I want to set my daily ordering deadline and payment options. | HH:MM validated; at least one payment method stays on; changing the deadline never changes placed orders (D-04). | FR-12, FR-13, FR-26 | Must | 2 | ✅ |
| 10 | US-10 | As a **customer** I want to choose dishes and quantities and see the total before ordering. | Total = Σ quantity × price, exact in millimes; 1–50 per dish. | FR-09–FR-11 | Must | 3 | ✅ |
| 11 | US-11 | As a **customer** I want to place my order before the deadline and get an order number. | Accepted before the deadline, refused at/after it with ORDER-001; order number FG-XXXXXX; retry with same Idempotency-Key never duplicates. | FR-12–FR-14, BR-01 | Must | 5 | ✅ |
| 12 | US-12 | As **restaurant staff** I want new orders to appear in my queue immediately. | Live board; only my restaurant's orders; customer verification info shown. | FR-15, FR-16, BR-09 | Must | 3 | ✅ |
| 13 | US-14 | As **restaurant staff** I want the information I need to verify a customer. | Only for customers registered at my restaurant. | FR-16, BR-15 | Must | 2 | ✅ |
| 14 | US-15 | As **restaurant staff** I want to mark a customer eligible or not for my organization rule. | Ineligible customers lose access to my restaurant only. | FR-17, BR-04 | Must | 2 | ✅ |
| 15 | US-16 | As **restaurant staff** I want to assign an order to one of my delivery people. | Only my own couriers; assignment exists before dispatch; no double assignment. | FR-19, BR-06, BR-10 | Must | 3 | ✅ |
| 16 | US-17 | As a **delivery person** I want to see only the orders assigned to me with the details I need. | Scoped query; destination, phone, items, cash to collect. | FR-20, FR-21, BR-08, BR-15 | Must | 3 | ✅ |
| 17 | US-18 | As a **delivery person** I want to start a delivery and confirm it when delivered. | Confirm only after start, only by the assignee, only once. | FR-22, FR-23, BR-11 | Must | 3 | ✅ |
| 18 | US-21 | As a **customer** I want to choose cash on delivery or e-payment. | Only methods the restaurant enabled. | FR-25, FR-26 | Must | 2 | ✅ |
| 19 | US-23 | As the **restaurant** I want every order's payment status recorded. | Payment row created with the order; cash marked paid when the courier confirms collection; order shows a projection of it. | FR-28, BR-12 | Must | 3 | ✅ |
| 20 | US-26 | As a **developer** I want CI to lint and test every pull request. | GitHub Actions on Node 22 and 24; coverage ≥ 60 %. | Course rubric | Must | 2 | ✅ |
| 21 | US-27 | As a **developer** I want API documentation. | OpenAPI 3 file + Swagger UI at `/api/docs`. | Course rubric | Must | 3 | ✅ |
| 22 | US-28 | As the **team** we want before/after metrics for refactoring and performance. | Report with complexity, lint, coverage, latency. | Course rubric | Must | 5 | ✅ |
| 23 | US-13 | As **restaurant staff** I want to move an order into preparation. | Only legal transitions (State pattern). | BR-14 | Should | 1 | ✅ |
| 24 | US-19 | As a **customer** I want to follow my order's progress live. | Status updates without refreshing; I never see other people's orders. | FR-24, BR-14, BR-15 | Should | 3 | ✅ |
| 25 | US-22 | As a **customer** I want to pay electronically through a supported Tunisian provider. | Sandbox adapter now; declined payment rolls back the order (PAY-001); provider down → PAY-002. Real provider blocked on Q-22. | FR-27, BR-13 | Should | 5 | ✅ sandbox / ⛔ real provider |
| 26 | US-24 | As **restaurant staff** I want a forecast of tomorrow's dishes so that I prepare the right quantities. | Per-dish expected quantity, range, confidence; accuracy shown; advice only, never changes orders; optional Claude summary. | FR-31 (PROPOSED), BG-03, BG-04 | Should | 8 | ✅ |
| 27 | US-25 | As the **administrator** I want to monitor today's orders and security events. | Read-only monitor with audit trail. | BG-09, §15 | Should | 3 | ✅ |
| 28 | US-31 | As the **team** we want the app deployed on a public host. | HTTPS, persistent volume for SQLite. | §7 availability | Should | 3 | 🔜 |
| 29 | US-20 | As a **delivery person** I want to record failed deliveries. | — | Q-07, Q-20 | Could | 3 | ⛔ |
| 30 | US-29 | As a **customer** I want to cancel an order before preparation. | — | Q-04–Q-06 | Could | 5 | ⛔ |
| 31 | US-30 | As the **platform** we want real SMS and e-mail notifications. | Adapter swap only. | §5.2.2, Q-22 | Could | 5 | 🔜 |

**Sprint 1 velocity (midterm MVP):** 86 story points done out of 102 in the backlog.

## Non-functional requirements

The specification states quality attributes without numbers (§7). The targets below are the spec's own **Proposed** targets; the "How we check it" column says what is actually verified today.

| ID | Attribute | Requirement / target | How we check it | Status |
|---|---|---|---|---|
| NFR-01 | Performance | 95 % of API requests < 500 ms, 99 % < 1.5 s; order submission < 2 s | `scripts/benchmark.js` (see refactor report) | ✅ measured |
| NFR-02 | Security | Authenticated roles, restaurant-scoped authorisation, hashed credentials, rate-limited sign-in, safe errors, security headers | Integration tests (AUTH-001/002 cases), helmet, express-rate-limit | ✅ |
| NFR-03 | Privacy | Customer data visible only to authorised parties (BR-15); no personal data sent to the LLM | Scope tests, prompt privacy test | ✅ |
| NFR-04 | Reliability | No lost, duplicate or half-written orders | Transactions T1–T3, Idempotency-Key, rollback tests | ✅ |
| NFR-05 | Maintainability | Business rules separated from UI and persistence; lint clean; complexity ≤ 10 per function | Layered architecture, ESLint `complexity` rule, CI | ✅ |
| NFR-06 | Testability | Each feature has unit + integration tests; ≥ 60 % line coverage | `npm run coverage` in CI: 97.3 % of all server code (`src/`, browser files excluded); 36 unit + 83 integration tests | ✅ |
| NFR-07 | Usability | Simple ordering in ≤ 4 screens; deadline visible before ordering | Customer UI | ✅ |
| NFR-08 | Accessibility | Labelled controls, keyboard focus, reduced motion; WCAG 2.2 AA target | Manual review | 🔜 full audit |
| NFR-09 | Observability | Audit log of security-relevant actions; health endpoint | `audit_event`, `/health`, admin monitor | ✅ |
| NFR-10 | Interoperability | Payment, SMS/OTP, notification, LLM behind adapters | Adapter unit tests | ✅ |
| NFR-11 | Availability | 99.5 % during service hours | Not measurable before deployment | 🔜 |
| NFR-12 | Portability | Runs with Node.js 22+ only, no external service required | Fresh-clone check in README | ✅ |

## AI-assisted elicitation record

As the course requires, this is the prompt used to turn the specification into stories, followed by what the team changed.

**Prompt (Claude, 1 Nov 2026):**

> Act as a product analyst. Given: the FoodGO Software Specification (30 functional requirements FR-01–FR-30, 16 business rules, acceptance criteria in §17, and the unresolved items in §19). Produce: (1) user stories with acceptance criteria for every FR, grouped into epics; (2) the non-functional requirements with measurable targets where the specification proposes them; (3) a MoSCoW priority and a story-point estimate per story. Keep every requirement ID. Do not invent behaviour for unresolved items: mark them blocked.

**What the team changed after review:**

- Merged FR-01–FR-04 into one registration story (US-01): they are one in-person action at the counter.
- Added the BR-05 "identity checked in person" checkbox to US-01's criteria; the AI draft only collected data.
- Raised US-22 (e-payment) from Could to Should, but split its status: the sandbox is done, the real provider stays blocked on Q-22.
- Added US-24 (AI forecast) after the team withdrew assumption A-13; the AI draft had correctly left AI out because the spec excluded it.
- Re-estimated three stories the AI under-estimated (US-02 OTP 3→5, US-11 ordering 3→5, US-24 forecast 5→8).
