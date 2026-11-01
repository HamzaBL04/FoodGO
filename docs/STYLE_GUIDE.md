# FoodGO coding style guide

The rules are enforced by [ESLint](../eslint.config.js) and [EditorConfig](../.editorconfig). CI fails if `npm run lint` fails.

## Language and modules

- Node.js ≥ 22 (LTS), CommonJS (`require`) on the server, ES modules in the browser (`src/public/js`).
- `'use strict';` at the top of every server file.
- `const` by default, `let` only when the value changes. No `var`.
- Strict equality only (`===`, `!==`).

## Formatting

- 2-space indentation, LF line endings, UTF-8, final newline.
- Single quotes for strings, template literals for interpolation.
- Keep functions short. ESLint warns above cyclomatic complexity 10 and nesting depth 3.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files | camelCase | `orderManagement.js` |
| Classes | PascalCase | `CashOnDeliveryStrategy` |
| Functions, variables | camelCase | `submitOrder` |
| Constants | UPPER_SNAKE | `ORDER_STATUS` |
| DB tables and columns | snake_case | `delivery_assignment.assigned_at` |
| Error codes | the specification's codes | `ORDER-001` |

## Layer rules (from the SDD §2.4)

1. Route handlers (`src/api`) contain no business rules. They validate input, call one component, and shape the response.
2. Only repositories (`src/repositories`) issue SQL. A component never names a table.
3. Every repository method that touches restaurant-owned data takes the restaurant scope as a required argument.
4. Authentication and authorisation run as middleware before the component.
5. Only `orderManagement` creates orders or changes their status, through `OrderState.transition()`.
6. Third-party contracts (payment, SMS/OTP, notification, LLM) are reached only through `src/adapters`.

## Errors

Throw `AppError` (`src/domain/errors.js`) with one of the specification's error codes (§14.2). Never leak stack traces or SQL in responses.

## Tests

- `node:test` and `supertest`. Unit tests in `test/unit`, integration tests in `test/integration`.
- Every feature PR adds tests. Coverage must stay ≥ 60% lines (CI enforces it).
- Tests use an in-memory database and a fixed clock, never the developer's data.

## Commits and PRs

- Conventional commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`.
- One feature per branch (`feat/<name>`), merged through a pull request after CI passes.
- AI-generated code is disclosed in the PR description and in `docs/ai/AI_USAGE_LOG.md`.
