# Ethics and AI usage reflection

## Where we used AI

We used AI in two different ways, and they carry different risks.

**AI as a development tool.** Claude (Anthropic) drafted almost all of the code, tests, diagrams and documentation of this midterm MVP from our own Lab 3 specification and Lab 4 design. We gave it the goals, the constraints and the decisions. It produced pull requests that went through the same gate as any human code: lint, more than 100 automated tests, a coverage threshold and a review of each PR against the SDD. The full record is in `AI_USAGE_LOG.md`, and every AI-assisted commit carries a `Co-Authored-By` trailer.

**AI as a product feature.** The restaurant's *Prep forecast* screen estimates how many of each dish the kitchen should prepare and, if an API key is configured, asks Claude to turn those numbers into a three-sentence note. Our specification originally excluded AI (assumption A-13). We withdrew that assumption on 1 November 2026 because AI is the subject of this course and because two of our own business goals (BG-03 "help restaurants predict demand" and BG-04 "improve meal preparation planning") are better served with a forecast than without one.

## Risks we considered, and what we did

**Wrong or overconfident code.** An assistant can write code that looks right and is not. We did not accept anything that was not covered by tests. The tests encode the business rules by their specification IDs (BR-01 deadline, BR-08 delivery scope, BR-15 privacy…), the coverage gate stops a PR below 60 %, and the traceability matrix is generated from the code, so a requirement without code and a test shows up as a gap.

**Security.** Generated code tends to forget authorisation. Our design made the safe path the only path: every restaurant-owned query requires the restaurant id as an argument, and role and scope checks run as middleware before any business code. We tested the attacks we care about: a customer reading another customer's order, staff reaching another restaurant through the URL, a courier confirming someone else's delivery.

**Inventing business rules.** When the specification is silent (cancellation, refunds, failed delivery), an assistant will happily fill the gap with something plausible. We told it not to. Those behaviours are absent and listed as blocked in the backlog. Where the code had to take a position to run (for example, an order arriving exactly at the deadline is refused), it is marked PROPOSED in comments and documents.

**Over-reliance and learning.** The biggest risk to us as students is shipping a system we cannot explain. We plan a code walkthrough before the defence, and the architecture deliberately follows our own SDD so that every module maps to a section we wrote ourselves.

**Privacy in the AI feature.** The forecast prompt contains only dish names and counts. A test fails if a customer's name or phone number ever appears in it. The LLM is off by default, and when it fails or times out the app silently falls back to a template.

**Automation bias and fairness.** A forecast can make staff cook too little and run out, or too much and waste food. We chose a transparent model (weighted averages anyone can check with a calculator) over an opaque one, and we show its own error from a seven-day backtest on the same screen, plus a confidence label per dish. The forecast is labelled as advice and cannot touch orders, payments, eligibility or the menu. It uses aggregate dish counts, never individual customers, so it cannot treat customers differently.

**Licences and intellectual property.** AI-generated code may resemble code it was trained on. We used it to build standard patterns (Express routes, SQL, repository classes) and wrote nothing that reproduces a known project. All dependencies are permissively licensed npm packages listed in `package.json`; the two fonts are under the SIL Open Font License, included in `src/public/fonts`. We credit the AI in commits and documents because the course asks for transparency about authorship, and we checked the provider's terms of use before adopting it.

**Academic honesty.** Our course encourages AI-assisted work with disclosure. We disclose: the AI wrote most of the lines; the team owned the requirements, the design, the decisions recorded in the log, and the review. The signed statement in `docs/ACADEMIC_HONESTY_STATEMENT.md` says the same.

## What we would do differently

Start the implementation earlier, so that a human-written first version of at least one component can be compared with the AI version. Pair-review each PR live instead of reviewing after the fact. Collect real order data from a pilot restaurant before trusting the forecast, since the current history is synthetic demo data.
