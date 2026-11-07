# AI-First Activity 1 — SRS with Prompt Engineering (FoodGO)

**Course:** CS 488 AI-First Software Engineering, Fall 2026 · **Team:** Hamza Ben Labiedh, Ali Chamakh, Mohamed Krid · **Date run:** 7 Nov 2026

**Project idea used in every prompt:** FoodGO — a web app where employees in the Lac 3 / Zone Industrielle Le Kram area of Tunis pre-order lunch from local restaurants before a morning deadline; each restaurant delivers with its own staff at noon, to reduce lunchtime traffic in the area. Payment is cash on delivery or Tunisian e-payment.

**How the prompts were run.** Each prompt was sent to Claude (Sonnet) in a **fresh session with no project context**, one session per prompt, so Step A and Step B never saw each other. Prompt chaining (Part 4B) used two prompts in one session. Part 5 pasted the same draft (our Part 2B + 3B + 4B outputs) into both prompts. Outputs below are the **AI's raw answers, unedited** except that their headings were demoted to fit this document. The comparisons are ours.

> **Honest note.** We ran this activity late (7 Nov), on the final version of the idea, after our SRS (Lab 2) was already written. So it did not shape the SRS; instead we compare its outputs with the SRS in the conclusion.

**Summary of results**

| Part | Technique | Better version | Main reason |
|---|---|---|---|
| 1 Stakeholders | Providing concept | **B** (slightly) | Covered the categories the definition named — maintainers and especially regulators — more completely; A was already broad |
| 2 Functional requirements | One-shot | **B** | Identical format for all 10, each with priority and rationale; closer to one need per requirement |
| 3 Non-functional requirements | Few-shot | **B** (clearly) | All 10 have a measurable target; A had several unmeasurable ones |
| 4 User stories | Prompt chaining | **B** for clarity, **A** for breadth | B: traced to REQ IDs, exactly 3 Given/When/Then each; A: wider but inconsistent and invented scope |
| 5 Quality review | Self-critique | **B** for testability, **A** for consistency | B listed, rewrote and justified; A caught more contradictions between requirements |
