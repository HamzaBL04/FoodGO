# FoodGO — Software Requirements Specification (draft skeleton)

**Lab 3, Step 6 deliverable.** Structure from the Lab 2 SRS template (IEEE 830 / ISO/IEC/IEEE 29148), Sections 1–7. As the lab asks, **Sections 4 and 5 are complete**: they are our Step 3 list after the Step 5 peer-review revisions. The other sections are short placeholders. **The complete SRS (Lab 2) is [`../lab2-srs/FoodGO_SRS.md`](../lab2-srs/FoodGO_SRS.md)**; it is generated from Sections 4–5 of this file, so they always match.

**Version:** 0.2 draft, 1 Nov 2026 · **Team:** Hamza Ben Labiedh, Ali Chamakh, Mohamed Krid

**Labels.** *Validated* = from our validated elicitation document. *Team decision* = decided by the team after Lab 3, recorded in an ADR. *Proposed* = a position we took to make the system buildable; still to be validated with stakeholders.

---

## 1. Introduction _(placeholder)_

- **Purpose:** the requirements of FoodGO, for the team, the instructor and future maintainers.
- **Scope:** pre-order lunch for workplaces in **Lac 3 / Zone Industrielle Le Kram** (one area, two names), to cut lunchtime traffic there. The restaurant prepares and delivers with its own staff; the platform coordinates.
- **Definitions** (one term each, used everywhere below):
  - **Customer** — an employee or student whose workplace is in the service area.
  - **Customer account** — the access a restaurant creates for a customer in person; one account per person, one membership per restaurant.
  - **Workplace** — the office, factory, school or institution a customer belongs to (stored as an *organization*); it is always inside the service area.
  - **Service area** — Lac 3 / Zone Industrielle Le Kram.
  - **Delivery person** — a person employed and equipped by a restaurant to deliver its orders (not "courier").
  - **Ordering deadline** — the restaurant's daily cut-off time for the same day's orders.
- **References:** Lab 3 specification; Lab 4 SDD; ADR-0004 (AI forecast); ADR-0007 (service area); backlog.

## 2. Overall description _(placeholder)_

- **Product perspective:** a web application with four interfaces (customer, restaurant, delivery person, administrator) and adapters to an e-payment provider, an SMS/OTP service and an optional LLM.
- **User classes:** see the stakeholder list in the Lab 3 worksheet.
- **Constraints:** BR-01–BR-18; the do-not-implement list (spec §20.11) still applies except item 05, AI prediction, which the team withdrew for advisory use only (ADR-0004, Proposed).
- **Assumptions:** spec A-01–A-15, except A-13 (AI out of scope), withdrawn by the team on 1 Nov 2026.
- **Resolved since the specification:** unresolved item 35 *Initial deployment area* → Lac 3 / Zone Industrielle Le Kram; item 10 *Delivery-area rules* → partly (one area; restaurants outside it cannot join). Both by ADR-0007.

## 3. System features / use cases _(placeholder)_

Use-case diagram and the UC-01 / UC-04 descriptions: Lab 3 worksheet, Step 4. Full use-case register: complete SRS §3.

---

## 4. Functional requirements

Identifiers are kept from the specification so traceability does not break. Wording changed after the peer review is marked **(rev.)**.

### 4.1 Accounts and access

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | **(rev.)** The system shall allow authorized restaurant staff to create a customer account, valid only for their own restaurant. The system shall not offer customer self-registration. | Must | Validated |
| FR-02 | The system shall store the customer's full name and show it only to authorized parties. | Must | Validated |
| FR-03 | **(rev.)** The system shall store the customer's phone number and reject a number that is not in the form +216 followed by 8 digits. | Must | Validated |
| FR-04 | **(rev.)** The system shall store the customer's workplace. | Must | Validated |
| FR-29 | The system shall allow the platform administrator to create restaurant staff accounts, each bound to exactly one restaurant. | Must | Validated |
| FR-30 | The system shall allow a restaurant to create accounts for its own delivery persons, visible to no other restaurant. | Must | Validated |

### 4.2 Service area

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-32 | **(rev.)** The system shall record, for every restaurant and every workplace, that it is located in the service area, and shall refuse to create a restaurant or workplace located anywhere else. | Must | Team decision (ADR-0007) |

### 4.3 Restaurants and menus

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-05 | The system shall show a customer only the restaurants that created their account and still consider them eligible. | Must | Validated |
| FR-06 | The system shall show a customer the menu of each of those restaurants, including dishes that are currently unavailable, marked as such. | Must | Validated |
| FR-07 | **(rev.)** The system shall allow authorized staff of a restaurant to create, edit and remove that restaurant's menu items (name, description, price). | Must | Validated |
| FR-08 | The system shall allow authorized restaurant staff to mark a menu item available or unavailable; an unavailable item cannot be ordered. | Must | Validated |

### 4.4 Ordering

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-09 | The system shall allow a customer to add available menu items to an order. | Must | Validated |
| FR-10 | The system shall allow a customer to set a quantity from 1 to 50 for each item. | Must | Validated |
| FR-11 | **(rev.)** The system shall calculate the order total as the sum of quantity × unit price over all items, exact to the millime. | Must | Validated |
| FR-12 | **(rev.)** The system shall accept an order only if it is submitted strictly before its restaurant's ordering deadline for that day. | Must | Validated |
| FR-13 | **(rev.)** The system shall reject an order submitted at or after the deadline and tell the customer the deadline time. | Must | Validated |
| FR-14 | The system shall confirm each accepted order with a unique identifier, and a retried submission shall return the same order rather than create a second one. | Must | Validated |
| FR-15 | The system shall make an accepted order visible to its restaurant, and to no other restaurant, as soon as it is accepted. | Must | Validated |

### 4.5 Customer verification

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-16 | The system shall show authorized staff of a restaurant the name, phone number and workplace of the customers registered at that restaurant. | Must | Validated |
| FR-17 | **(rev.)** The system shall allow authorized restaurant staff to mark a customer ineligible; an ineligible customer shall neither see nor order from that restaurant. | Must | Validated |

### 4.6 Delivery

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-18 | **(rev.)** The system shall allow a restaurant to create and list its own delivery persons. Deactivation and other management details remain unresolved (spec item 12). | Must | Validated |
| FR-19 | The system shall allow authorized restaurant staff to assign an order to one of that restaurant's active delivery persons. | Must | Validated |
| FR-20 | The system shall show a delivery person only the orders assigned to them. | Must | Validated |
| FR-21 | The system shall give the delivery person, for each assigned order, the pickup restaurant, the customer's name, phone and workplace, the items, and the cash amount to collect. | Must | Validated |
| FR-22 | The system shall allow the assigned delivery person to mark a delivery as started. | Must | Validated (states Proposed) |
| FR-23 | The system shall allow only the assigned delivery person to confirm a started delivery, recording the confirmation against that order. | Must | Validated |
| FR-24 | The system shall show a customer the current status of their own orders, updated without reloading the page. | Should | Validated |

### 4.7 Payment

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-25 | The system shall allow a customer to choose only among the payment methods the restaurant has enabled. | Must | Validated |
| FR-26 | **(rev.)** When a restaurant enables cash on delivery, the system shall record the payment as pending at ordering and as paid when the delivery person confirms the cash was collected. | Must | Validated |
| FR-27 | **(rev.)** When an approved Tunisian e-payment provider is integrated, the system shall take payment through it at ordering and shall not create the order if the payment is declined. | Should | Validated (provider unresolved) |
| FR-28 | The system shall record each order's payment method and payment status. | Must | Validated |

### 4.8 Planning support

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-31 | **(rev.)** The system shall show authorized restaurant staff a next-service quantity forecast and range per menu item, computed only from aggregated order counts. The forecast shall not create, change, accept or reject any order, payment, eligibility or menu record. | Should | **Proposed** (ADR-0004; stakeholder validation pending) |

### 4.9 Business rules added after the specification

| ID | Rule | Status |
|---|---|---|
| BR-17 | **(rev.)** An order shall be accepted only if both the restaurant and the customer's workplace are located in the service area. | Team decision (ADR-0007) |
| BR-18 | **(new)** A restaurant located outside the service area cannot join FoodGO, even to deliver into it. | Team decision (ADR-0007) |

BR-01–BR-16 are unchanged (spec Appendix A5).

---

## 5. Non-functional requirements

Targets are the specification's **Proposed** targets unless marked otherwise. Tool names were moved out of the requirements into the SDD after the peer review.

| ID | Category | Requirement | Priority | How it is checked |
|---|---|---|---|---|
| NFR-01 | Performance | **(rev.)** With 300 orders already placed for the day at one restaurant, 95 % of requests shall complete within 500 ms and 99 % within 1.5 s; order submission within 2 s, excluding the payment provider. | Must | `npm run benchmark` |
| NFR-02 | Security | **(rev.)** The system shall authenticate every user, allow each role only its own functions, limit restaurant staff and delivery persons to their own restaurant's data, store credentials only as salted hashes, and slow down repeated failed sign-ins. | Must | Integration tests |
| NFR-03 | Privacy | Customer data shall be visible only to authorized parties (BR-15), and no customer data shall be sent to the LLM. | Must | Scope tests, prompt test |
| NFR-04 | Reliability | The system shall never lose, duplicate or half-save an order. | Must | Transaction and retry tests |
| NFR-05 | Maintainability | **(rev.)** Business rules shall be separated from the user interface and from data storage, and no function shall exceed a cyclomatic complexity of 10. | Should | Lint in CI |
| NFR-06 | Testability | Each feature shall have automated tests, with at least 60 % line coverage of server code. | Must | Coverage in CI |
| NFR-07 | Usability | A customer shall be able to place an order in at most 4 screens, and shall see the ordering deadline before ordering. | Should | UI review |
| NFR-08 | Accessibility | The user interface shall meet WCAG 2.2 level AA. | Should | Audit (planned) |
| NFR-09 | Observability | Every security-relevant action (sign-in, provisioning, order, assignment, delivery, payment) shall be recorded in an audit log, and the service shall expose a health check. | Should | Admin monitor |
| NFR-10 | Interoperability | **(rev.)** Each external provider (payment, SMS/OTP, notification, LLM) shall be replaceable without changing business rules. | Should | Adapter tests |
| NFR-11 | Availability | The system shall be available 99.5 % of each month during the service window. **The service window is still a business decision**, so this target cannot be tested yet. | Should | After deployment |
| NFR-12 | Portability | **(rev.)** The system shall install and run on a fresh machine with a single install command and no external service. | Could | Fresh-clone check |
| NFR-13 | Scalability | **(new, Proposed)** The system shall handle the morning ordering peak of the whole service area. Target numbers (restaurants, customers, orders per peak) are set after the Sprint 2 interviews. Serving another area requires a new ADR. | Should | Benchmark at the agreed numbers |
| NFR-14 | Compatibility | **(new, Lab 2 validation)** The customer and delivery interfaces shall work on the current versions of Chrome, Safari and Firefox on phones, and the restaurant and admin interfaces on the same browsers on desktop. | Should | Manual check per release |
| NFR-15 | Legal / compliance | **(new, Lab 2 validation)** The personal-data and e-payment obligations that apply in Tunisia shall be identified and met before production use. **Unresolved** (spec §7.11): which obligations apply is not yet decided. | Must (before production) | Compliance review |

---

## 6. Requirements traceability matrix _(placeholder)_

Complete SRS §6, and the generated code-and-test matrix in `docs/requirements/TRACEABILITY.md`.

## 7. Appendices _(placeholder)_

Elicitation log (Lab 3 worksheet, Step 1), glossary (Section 1), unresolved items (spec Appendix A6, minus items 35 and part of 10).
