## Conclusion

1. **Structure in the prompt became structure in the answer.** Each technique gave a more usable SRS section than the plain prompt. The biggest gains came from **few-shot** (measurable NFRs) and **one-shot** (consistent, prioritised FRs). **Providing a concept** helped least, because the plain answer was already broad.
2. **Chaining keeps the AI inside the agreed scope.** The single-shot user stories invented features (like order cancellation) that our specification deliberately leaves open. Feeding the model our own requirements first prevented that.
3. **Self-critique turns review into a procedure.** It produced testable rewrites and explained why. A free review still found contradictions it missed, so we would use both.
4. **AI-invented numbers are assumptions, not facts.** Targets like 500 users, SUS ≥ 75 or a 15-minute lock look precise but came from the model. They must be confirmed with stakeholders before they enter the SRS.

**Compared with our SRS (Lab 2).** Our SRS already uses the patterns these techniques push towards: IDs with priority and rationale, NFRs with numbers (95 % under 500 ms), Given/When/Then-style acceptance criteria, and a review that rewrote vague verbs. The activity surfaced a few points worth adding later: rate-limiting SMS codes (our app already rate-limits sign-in), stating the time zone in the deadline requirement, and a defined delivery window. We record these as suggestions, not changes, since the SRS is a submitted deliverable.
