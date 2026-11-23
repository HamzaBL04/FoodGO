# Changelog

All notable changes to FoodGO. Newest at the top. One line per change. Based on [Keep a Changelog](https://keepachangelog.com). Categories: **Added**, **Changed**, **Fixed**, **Removed**.

## [Unreleased]

### Added
- AI-First Activity 1 (SRS with prompt engineering): 11 prompts run in fresh Claude sessions, raw outputs and comparisons (`docs/activity1-prompt-engineering/`).
- Branch protection on `main` (ruleset "protect main": PR + 1 approval + 3 checks, no bypass), with evidence in the Setup Report; merge checklist in `CONTRIBUTING.md`.
- Lab 6 workspace from the CS 488 starter template: `AI_CONTEXT.md` with per-tool AI configs (Claude, Copilot, Cursor), `CONTRIBUTING.md`, PR and issue templates, git hooks with a docs reminder, setup and structure scripts, `.env.example`, `docs/architecture.md`, `docs/setup.md`, ADRs 0001–0006, this changelog, Setup Report (ADR-0003).
- `npm start`, `npm run dev` and `npm run seed` read an optional `.env` file.
- CI job "Docs reminder" (never fails).
- Service area: FoodGO serves only Lac 3 / Zone Industrielle Le Kram (one area), to cut lunchtime traffic there (FR-32, BR-17, ADR-0007). Restaurants and workplaces carry a zone (migration 003); restaurants outside the area cannot join; orders outside the area are refused with ORDER-003; the area is shown to every role.

- Lab 2 complete SRS in the Lab 2 template (`docs/lab2-srs/`), generated from the reviewed requirements, the Lab 3 worksheet and the test traceability; NFR-14 (compatibility) and NFR-15 (legal/compliance, unresolved) added by the Lab 2 validation checklist.
- Lab 3 requirements-engineering practical session: worksheet (markdown + PDF) and SRS skeleton with revised Sections 4–5; joining rule numbered BR-18 (`docs/lab3-practical/`).
- `scripts/md-to-pdf.js` embeds local images and can join several files into one PDF.
- Lab 5 design practical session: filled-in handout (.docx), markdown worksheet, SDD Sections 1–2 skeleton, UC-15 forecast sequence diagram (`docs/lab5-design/`).

### Changed
- Licence: MIT (from the starter template).
- Creating a restaurant (admin) or a workplace (staff) now requires `serviceZone` (`LAC3_ZI_KRAM`, the only value).
- Demo data moved into the service area: Dar Lella stays; "Campus Bites" renamed Kram Snack (staff sign-in `staff@kramsnack.tn`); fictional workplaces Lac 3 Business Tower, Lac 3 Tech Hub, Kram Textile Works. Run `npm run seed` to rebuild a local database.
- UML revised after the Lab 5 peer review: Admin component and missing dependencies, control classes and forecast classes in the class diagram, sequence notation fixes; backlog story US-33 for intention-revealing order transitions.
- Proposal (v1.1), backlog (US-32), README, guides, architecture, OpenAPI and the demo video describe the new positioning.

### Fixed
- Only the Payment component writes a payment status (D-03): the checkout row and the order's projection are written in one call; Order Management no longer writes it, and e-payment orders no longer write the row twice (found by the Lab 5 peer review).

## [0.1.0] — 2026-11-01 — Midterm MVP

### Added
- Data layer: SQLite schema for the 12 SDD entities, scoped repositories, transactions, deterministic demo seed with 4 weeks of history (#1).
- Authentication: password sign-in for staff, delivery and admin; SMS one-time code for customers; sessions; admin restaurant and staff provisioning (#2).
- Restaurant management: menu and availability, deadline and payment settings, in-person customer registration, eligibility, delivery team accounts (#3).
- Ordering: pre-order submission with deadline gate, availability check, payment Strategy, idempotent retries, live events (#4).
- Delivery: assignment, start, confirmation with cash recording, end-to-end scenario test (#5).
- Web interfaces for customers, restaurants, delivery people and administrators (#6).
- AI-assisted Prep forecast for restaurants, FR-31 (#7).
- Documentation: proposal, backlog and NFRs, UML, OpenAPI with Swagger UI, traceability matrix, guides, AI usage log, ethics reflection (#8).
- Captioned demo video and its recording script (#10).

### Changed
- Order board and order history load items and assignments in batches; 8 new indexes; order board p50 52.7 → 9.8 ms (#9).
- Coverage measured over all server code (97.3 %); unit tests for components (#12).

### Fixed
- `npm install` no longer needs a C++ compiler (prebuilt SQLite binaries) (#11).
- Demo mode (SMS code on screen) is off by default in production (#12).
- Project documents corrected to describe the real Sprint 1 process (#12).
