# Lab 2 — Software Requirements Specification (FoodGO)

| File | What it is |
|---|---|
| [FoodGO_SRS.pdf](FoodGO_SRS.pdf) | **The deliverable:** the complete SRS in the Lab 2 template (Sections 1–7) |
| [FoodGO_SRS.md](FoodGO_SRS.md) | The same document, readable on GitHub. **Generated — do not edit by hand.** |
| [srs_template.md](srs_template.md) | The prose of Sections 1–3, 6.2 and 7 |
| [build_srs.py](build_srs.py) | Builds the SRS from the template, the reviewed requirements (`../lab3-practical/SRS_SKELETON.md`), the Lab 3 worksheet and the test traceability matrix |

Rebuild after any requirement change:

```bash
npm run traceability
python3 docs/lab2-srs/build_srs.py
node scripts/md-to-pdf.js docs/lab2-srs/FoodGO_SRS.md
```

The earlier slide-style specification (our first Lab 3 deliverable) is in [`../lab3-specification/`](../lab3-specification/); this SRS restates it in the Lab 2 template with the later team decisions (FR-31, FR-32, BR-17, BR-18) and the peer-review fixes.
