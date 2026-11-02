# 2. Node.js + Express + SQLite, plain HTML frontend

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The midterm required a runnable MVP that a grader can start "by following the README only", on any machine, within a short time box. The SDD prescribes a layered, client–server design with a relational store and no particular technology (SDD §2.1, §5.2: "the exact production API technology is Proposed"). The team knows JavaScript, and the course tooling (Copilot, Claude) works well with it.

## Decision

- **Runtime:** Node.js 22.14+ (LTS), CommonJS on the server.
- **Web:** Express 5 REST API under `/api/v1`, Server-Sent Events for live status.
- **Database:** SQLite through `better-sqlite3` (synchronous, real transactions, one file, no server).
- **Frontend:** four static pages with plain ES modules; no framework, no build step.
- **Quality:** `node:test` + `supertest` + `c8`, ESLint, GitHub Actions on Node 22 and 24.

## Consequences

- `npm install && npm start` is the whole setup; nothing external is needed.
- SQLite's synchronous API makes the SDD's transactions T1–T3 simple and race-free in one process.
- A single process limits horizontal scaling; the SDD's microservices revisit conditions (§2.1.4) and a move to PostgreSQL remain open if load grows.
- No UI framework means more hand-written DOM code; acceptable for four small interfaces.
- `better-sqlite3` 13 needs Node ≥ 22.14 (N-API 10), and its native build is avoided via prebuilt binaries (ADR-0006).
