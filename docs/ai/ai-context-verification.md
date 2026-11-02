# AI context verification (Lab 6, Step 3)

**Date:** 1 Nov 2026 · **Assistant:** Claude (a fresh agent with no knowledge of the project or of earlier conversations) · **Context given:** it was told to read only `AI_CONTEXT.md` and `CLAUDE.md`, then allowed to open at most three other files to confirm paths. It opened `src/domain/orderState.js`, `src/api/routes/staffRoutes.js` and `src/api/routes/orderRoutes.js`.

Two questions were asked: the handout's "where would I add feature X and which conventions apply" question, and a deliberate trap — a request for a feature our requirements mark UNRESOLVED.

## Question 1

> Based on this project's context, suggest the folder and file where I'd add a feature that lets restaurant staff mark an order as "ready for pickup" before assigning it, and what conventions I must follow.

**Answer (the assistant's reply, lightly condensed):**

> First, a flag: "ready for pickup" is a **new order status** (between IN_PREPARATION and ASSIGNED). CLAUDE.md says new order states need a stakeholder decision first, and the current lifecycle is itself only PROPOSED. Get that decision (or mark it PROPOSED with a reason) and record it in an ADR in `docs/decisions/`. Then:
>
> - **`src/domain/orderState.js`** — add `READY_FOR_PICKUP` to `ORDER_STATUS` and `STATES` (IN_PREPARATION → READY_FOR_PICKUP → ASSIGNED, keeping the `hasAssignment` / BR-10 guard; decide whether the SUBMITTED → ASSIGNED shortcut stays).
> - **`src/components/orderManagement.js`** — add `markReady(principal, restaurantId, orderId)` modelled on `startPreparation`: go through `OrderState.transition()`, run inside `repos.unitOfWork()`, publish the event only after commit (D-08).
> - **`src/api/routes/orderRoutes.js`** → `restaurantOrderRoutes`: `POST /:orderId/mark-ready`. The route only validates, calls the one component, responds; `restaurantId` comes from the path.
> - Repositories take `restaurantId` as a required argument (D-10); add a migration in `src/db/migrations/NNN_*.sql` if the DB constrains status.
> - **Tests:** `test/unit/orderState.test.js` + `test/integration/ordering.test.js` using `createTestApp()`, requirement ID in each test title.
> - **UI:** `src/public/restaurant.html` + its JS; escape server data with `esc()`, no inline handlers.
> - **Docs:** `openapi.yaml`, `CHANGELOG.md`, then `npm run traceability`.

**Why this is a good answer:** every path exists and is the right layer; it applied our specific rules (State pattern as the only way to change status, `unitOfWork`, events after commit, required restaurant scope, `createTestApp`, `esc()`, CHANGELOG/OpenAPI/traceability), and it noticed that a new status is a business decision rather than just code.

## Question 2 (trap)

> Customers keep asking to cancel orders. Please add an order cancellation endpoint for customers.

**Answer (the assistant's reply, lightly condensed):**

> I'd hold off on implementing this. Order cancellation is explicitly **UNRESOLVED** in the spec — `AI_CONTEXT.md` §5 lists it under "don't invent business rules", CLAUDE.md says not to add a `CANCELLED` state without a stakeholder decision, and `orderState.js` deliberately leaves it out (Q-04, Q-05, Q-09, Q-20). Building it now would mean me inventing the business rules.
>
> What the stakeholders need to decide:
> 1. **Cut-off** — until the ordering deadline? Only while SUBMITTED? After preparation starts?
> 2. **Money** — refunds are also unresolved; what happens to a paid order?
> 3. **Who** is notified (restaurant, assigned delivery person), and can restaurants configure it?
> 4. Do cancelled orders count in the prep forecast?
>
> Once decided, it fits the design cleanly: a `CANCELLED` state with guards in `src/domain/orderState.js`, `cancelOwnOrder` in `orderManagement` (in a `unitOfWork`), `POST /api/v1/customer/orders/:orderId/cancel` in `customerOrderRoutes`, refund handling in `paymentComponent`, plus tests, OpenAPI, CHANGELOG and an ADR.
>
> Want me to draft the stakeholder questions or a PROPOSED ADR in the meantime?

**Why this is a good answer:** a generic assistant would have written the endpoint. This one refused to invent a business rule, cited our own open questions, and turned the request into the decisions we actually need — exactly the behaviour `AI_CONTEXT.md` §5 asks for.

## Conclusion

`AI_CONTEXT.md` is specific enough: the assistant placed code in the right layers, applied project conventions it could only have learned from the file, and respected the "don't invent requirements" rule. No change to the file was needed after this test.
