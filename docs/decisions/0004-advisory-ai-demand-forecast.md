# 4. Withdraw assumption A-13: an advisory AI demand forecast (FR-31)

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The Lab 3 specification placed AI out of scope (assumption A-13), and the SDD designed none. The course is "AI-first" (outcome CLO3: design an AI-augmented solution), and two of our own business goals, BG-03 "help restaurants predict demand" and BG-04 "improve meal preparation planning", are served better with a forecast than with order counts alone. The spec also lists AI behaviours that must never happen (§10: authorising customers, accepting orders, processing payments, confirming deliveries).

## Decision

The team withdraws A-13 and adds **FR-31 (PROPOSED): an AI-assisted prep forecast for restaurant staff.**
- An explainable statistical model (same-weekday weighted average + recent trend, with a backtest of its own error), so staff can check it by hand.
- An optional LLM-written note (Claude via an adapter) only when `ANTHROPIC_API_KEY` is set; template fallback otherwise.
- Strictly advisory: it reads aggregates only and cannot change orders, payments, eligibility or the menu. The prompt contains no customer data (tested).

## Consequences

- The product now has a real AI component that fits the course and our goals without touching any forbidden decision.
- Accuracy depends on order history; the current history is synthetic demo data, so the shown error is indicative only.
- A new external dependency (the Anthropic API) exists but is optional and failure-tolerant.
- FR-31 must be validated with stakeholders before it becomes a requirement rather than a proposal.
