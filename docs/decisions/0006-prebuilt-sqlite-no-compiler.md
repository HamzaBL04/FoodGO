# 6. Install without a C++ toolchain (prebuilt SQLite binaries)

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Our pre-submission check cloned the repository fresh and ran `npm install`: npm tried to compile `better-sqlite3` with node-gyp, which needs Node headers and a C++ compiler. Most graders' laptops (especially Windows) have neither, so the MVP would not have installed, although the package already ships prebuilt binaries for Windows, macOS and Linux (x64 and arm64).

## Decision

Commit an `.npmrc` with `ignore-scripts=true`. npm then installs packages without running their install scripts, and `better-sqlite3` loads its bundled prebuilt binary. No other dependency needs an install script. `npm start`, `npm test` and other explicitly run scripts are unaffected.

## Consequences

- `npm install` works on a clean machine with only Node.js 22.14+.
- A future dependency that genuinely needs an install script will not get it; we would see it fail in CI and revisit this decision.
- Platforms without a prebuilt binary (rare) would need `npm rebuild better-sqlite3` with build tools; documented in `docs/setup.md`.
