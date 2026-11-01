'use strict';

/**
 * A clock is injected everywhere time matters (the ordering deadline,
 * session expiry, the forecast's "tomorrow"). Tests pass a fixed clock so
 * that BR-01 can be checked on both sides of the deadline deterministically.
 */
function systemClock() {
  return { now: () => new Date() };
}

function fixedClock(isoOrDate) {
  let current = new Date(isoOrDate);
  return {
    now: () => new Date(current.getTime()),
    set: (next) => {
      current = new Date(next);
    },
    advanceMinutes: (m) => {
      current = new Date(current.getTime() + m * 60000);
    },
  };
}

module.exports = { systemClock, fixedClock };
