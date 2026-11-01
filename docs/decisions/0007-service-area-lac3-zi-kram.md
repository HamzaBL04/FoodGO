# 7. Serve only Lac 3 / Zone Industrielle Le Kram, to cut lunchtime traffic (FR-32, BR-17)

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** the FoodGO team (product decision, recorded by Hamza Ben Labiedh)

## Context

Until now FoodGO was described as pre-order lunch for "Tunisian offices and campuses" in general. That is too broad to explain why the product is needed, or to test with real users.

**Lac 3 / Zone Industrielle Le Kram** is one office and industrial area of Tunis, known by both names. Traffic there gets heavy at lunchtime because many employees leave their workplace at the same time to get food.

Pre-ordering fits this problem directly. If lunch is ordered in the morning and the restaurant's own staff deliver it, employees stay at their desks. Many individual trips are replaced by a few planned delivery runs.

We have not measured the traffic yet. The problem statement comes from the team's own knowledge of the area and must be confirmed with users. See "Not decided" below.

## Decision

1. **FoodGO operates in one area only: Lac 3 / Zone Industrielle Le Kram.** The product's purpose is stated as reducing lunchtime traffic there by moving lunch ordering to the morning.
2. **FR-32:** every restaurant and every workplace (organization) records its zone. Today there is exactly one zone, `LAC3_ZI_KRAM`. The API refuses any other value (`VAL-001`), and so does the database (`CHECK` in migration `003_service_area.sql`).
3. **BR-18: restaurants must be located inside the area to join FoodGO.** A restaurant outside it cannot join, even if it would deliver into the area (team decision, confirmed by Hamza on 1 Nov 2026). Numbered BR-18 after the Lab 3 peer review.
4. **BR-17:** an order is accepted only when both the restaurant and the customer's workplace are inside the area. Otherwise it is refused with `ORDER-003`. This also catches rows created before the migration, which have no zone.
5. The area name is shown wherever a place is shown: the customer's restaurant list, the staff order queue and customer list, and the delivery person's pickup and destination.

**Why a zone field when there is only one area?** It lets the database and the API refuse places outside the area, and it keeps one obvious place to change if the team ever serves a second area. The zone list lives in `src/domain/serviceArea.js`. Adding an area needs a new ADR, then one line there and one in the migration's `CHECK`. That ADR must also decide whether a restaurant in one area may serve a workplace in another: today `assertInServiceArea` only checks that both are inside a served area, which is enough while there is one (noted by the Lab 5 peer review).

## Not decided (do not invent)

These are open questions for the team. The code deliberately does not enforce any of them:

- **Delivery time windows or staggered drop-offs** to spread deliveries over the lunch break. These would serve the traffic goal, but no rule has been agreed.
- **How traffic reduction is measured** (for example, trips avoided per day). This is needed to validate the goal; for now it is only a business-goal statement.

## Consequences

- The product has a concrete problem, a concrete place and testable users, which strengthens the proposal and the demo.
- This resolves the specification's unresolved item 35 (*initial deployment area*) and part of item 10 (*delivery-area rules*).
- The Lab 3 specification and the Lab 4 SDD are earlier, submitted deliverables and are not rewritten. This ADR and FR-32/BR-17 narrow them. Where they say "offices and campuses", read "workplaces in Lac 3 / Zone Industrielle Le Kram".
- The demo data was moved into the area: Dar Lella and Kram Snack (formerly "Campus Bites"), plus three fictional workplaces. The demo video was re-recorded.
- The `CAMPUS` and `INSTITUTION` organization types are kept: a training centre or school inside the area is still a valid destination.
- Existing local databases open normally but take no orders until zones are set; run `npm run seed` to rebuild the demo data.
