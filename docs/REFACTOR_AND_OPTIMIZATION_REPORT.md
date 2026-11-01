# Refactor and optimisation report

Midterm deliverable "Refactor & optimization report: before/after metrics (code smells fixed, test coverage, performance improvements)". Refactoring was done in one pull request (`refactor/performance-and-complexity`) after the feature PRs, with AI suggestions applied through the PR and checked by the test suite.

## How we measured

Everything below is reproducible from the repository:

```bash
npm run coverage          # writes coverage/coverage-summary.json
npm run metrics           # complexity distribution, lint problems, coverage, size  -> JSON
npm run benchmark         # API latency p50 / p95 / p99 on a large dataset          -> JSON
```

- **Complexity:** ESLint's `complexity` rule run with a threshold of 0 so it reports the cyclomatic complexity of every function in `src/`.
- **Benchmark dataset:** in-memory SQLite, 120 days of order history plus a lunch peak of **300 orders today** at one restaurant (2 200 orders in total). Each endpoint: 10 warm-up requests, then 200 timed sequential requests over HTTP on localhost. Node v22.23.4, same machine for both runs.
- Raw results: [`docs/metrics/`](metrics/) (`code-metrics-before/after.json`, `benchmark-before/after.json`).

## Code smells found and fixed

| # | Smell | Where | Fix |
|---|---|---|---|
| S-1 | **N+1 queries**: the order board and the order history loaded items and the delivery assignment with two extra queries **per order** (300 orders → 601 queries) | `orderManagement.listRestaurantOrders`, `listOwnOrders` | Two batch queries for the whole list (`listItemsForOrders`, `listAssignmentsForOrders`, using SQLite `json_each`) |
| S-2 | **Missing indexes**: every restaurant-scoped query did a full table scan | schema | Migration `002_query_indexes.sql`: 8 indexes, e.g. `orders(restaurant_id, service_date, created_at)`. A test checks `EXPLAIN QUERY PLAN` uses them. |
| S-3 | **Duplicated code**: three copies of an audit-trail helper with slightly different signatures | order, restaurant and delivery components | One `createAuditor()` in `src/components/audit.js` |
| S-4 | **Wasted work**: "start preparing" and "assign" rebuilt the whole day's board to return one order | `orderManagement`, `deliveryManagement` | `getRestaurantOrder()` reads one queue entry; the queue SQL is shared, not duplicated |
| S-5 | **Functions over the complexity limit** (11 > 10) | `api()` in `public/js/api.js`, `openJob()` in `public/js/delivery.js` | Extracted `requestInit()`, `toApiError()` and `actionFor()` |

## Before and after

### Code quality

| Metric | Before | After | Change |
|---|---:|---:|---|
| ESLint errors | 0 | 0 | — |
| ESLint warnings | 2 | **0** | −2 (both `complexity`) |
| Functions with cyclomatic complexity > 10 | 2 | **0** | −2 |
| Functions with complexity > 7 | 5 | **3** | −2 |
| Maximum complexity | 11 | **9** | −2 |
| Mean complexity (≈ 520 functions) | 1.78 | 1.78 | — |
| Duplicated audit helpers | 3 | 1 | −2 |

### Tests

| Metric | Before | After |
|---|---:|---:|
| Tests | 105 | **110** (+5 performance and refactor tests) |
| Line coverage | 99.54 % | 99.55 % |
| Branch coverage | 93.81 % | 93.85 % |
| Function coverage | 95.76 % | 95.91 % |

No behaviour changed: the 105 existing tests passed unchanged after every refactoring step, and a new test checks the batched views equal the per-order views field by field.

### Performance (milliseconds, lower is better)

| Endpoint | p50 before | p50 after | p95 before | p95 after | Speed-up (p50) |
|---|---:|---:|---:|---:|---:|
| GET restaurant order board, 300 orders | 52.70 | **9.82** | 77.67 | **16.19** | **5.4×** |
| GET customer order history | 10.19 | **2.50** | 15.54 | **4.22** | **4.1×** |
| GET prep forecast (120 days of history) | 5.57 | **3.26** | 8.02 | **4.77** | 1.7× |
| GET delivery assignments | 5.48 | 5.43 | 7.59 | 8.90 | ≈ same (within noise) |
| POST submit order (transaction T1) | 1.56 | 1.63 | 1.94 | 2.12 | ≈ same (within noise) |

| Memory | Before | After |
|---|---:|---:|
| Heap used after the run | 38.9 MB | **30.8 MB** |
| Resident set size | 169.8 MB | 176.3 MB (indexes are held in memory) |

All endpoints now meet the specification's proposed target (NFR-01: p95 < 500 ms, order submission < 2 s) with a wide margin. The biggest win is where the specification says load concentrates: the restaurant's view during the lunch peak.

## What we did not change, and why

- **Delivery assignments and order submission** were already fast and dominated by fixed costs (HTTP, JSON, bcrypt-free session lookup); the differences are noise between runs. Index maintenance adds a few microseconds per insert, which is visible as +0.07 ms on submission and is an acceptable trade.
- **`createContext` (complexity 9)** is the composition root: its branches are `adapters.x || default` choices for dependency injection. Splitting it would hide the wiring, so we kept it.
- **Synchronous SQLite** is deliberate (boring technology, one process, transactions without callbacks). If one restaurant ever exceeded what a single process can serve, the SDD's microservices revisit conditions (§2.1.4) apply first.

## AI involvement

The smells were found by measuring first (metrics and benchmark scripts written with Claude), then asking for refactorings targeted at each measured problem. Each change went through the PR with the full test suite; we kept only changes that left all tests green and improved a number in the tables above.
