# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

As a team we make decisions throughout the project: framework, database, how to structure a feature, which trade-off to accept. Three weeks later nobody remembers *why*, and we re-argue it or accidentally undo it. Our Lab 4 SDD already records twelve design decisions (D-01 to D-12); decisions taken during implementation need the same treatment.

## Decision

We record every notable decision as a short **Architecture Decision Record (ADR)** in this folder, one file per decision, numbered in order (`0002-…`, `0003-…`). Each ADR has: Status, Date, Context, Decision, Consequences. Design decisions from the SDD keep their D-xx numbers and are not duplicated here.

## Consequences

- New teammates (and the grader) can read the reasoning behind the code.
- We stop re-litigating settled decisions.
- It costs about five minutes per real decision.

> **How to add one:** copy `TEMPLATE.md` to the next number, fill it in, and commit it in the same PR as the change it describes.
