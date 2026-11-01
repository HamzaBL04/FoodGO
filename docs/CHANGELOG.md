# Changelog

All notable changes to FoodGO. Newest at the top. One line per change. Based on [Keep a Changelog](https://keepachangelog.com). Categories: **Added**, **Changed**, **Fixed**, **Removed**.

## [Unreleased]

### Added
- Lab 6 workspace from the CS 488 starter template: `AI_CONTEXT.md` with per-tool AI configs (Claude, Copilot, Cursor), `CONTRIBUTING.md`, PR and issue templates, git hooks with a docs reminder, setup and structure scripts, `.env.example`, `docs/architecture.md`, `docs/setup.md`, ADRs 0001–0006, this changelog, Setup Report (ADR-0003).
- `npm start`, `npm run dev` and `npm run seed` read an optional `.env` file.
- CI job "Docs reminder" (never fails).
- Service area: FoodGO serves only Lac 3 / Zone Industrielle Le Kram (one area), to cut lunchtime traffic there (FR-32, BR-17, ADR-0007). Restaurants and workplaces carry a zone (migration 003); orders outside the area are refused with ORDER-003; the area is shown to every role.

### Changed
- Licence: MIT (from the starter template).
- Creating a restaurant (admin) or a workplace (staff) now requires `serviceZone` (`LAC3_ZI_KRAM`, the only value).
- Demo data moved into the service area: Dar Lella stays; "Campus Bites" renamed Kram Snack (staff sign-in `staff@kramsnack.tn`); fictional workplaces Lac 3 Business Tower, Lac 3 Tech Hub, Kram Textile Works. Run `npm run seed` to rebuild a local database.
- Proposal (v1.1), backlog (US-32), README, guides, architecture, OpenAPI and the demo video describe the new positioning.

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
