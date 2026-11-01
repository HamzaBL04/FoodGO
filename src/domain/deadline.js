'use strict';

/**
 * Ordering deadline rules: BR-01, FR-12, FR-13, D-04.
 * The deadline is a restaurant-local wall-clock time ("HH:MM"). The process
 * time zone is fixed in config.js (Africa/Tunis by default).
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function isValidDeadline(value) {
  return typeof value === 'string' && HHMM.test(value);
}

/** Local calendar date, YYYY-MM-DD. */
function localDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  return localDateString(dt);
}

/** The deadline instant for a service date, as a Date. */
function deadlineInstant(serviceDate, deadlineHHMM) {
  const [y, m, d] = serviceDate.split('-').map(Number);
  const [hh, mm] = deadlineHHMM.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * Evaluates the deadline gate for a submission at `now`.
 * Boundary behaviour (SDD §6.3, U-8): a request at or after the deadline
 * instant is refused. Flagged for stakeholder confirmation.
 */
function evaluateDeadline(now, deadlineHHMM) {
  const serviceDate = localDateString(now);
  const deadline = deadlineInstant(serviceDate, deadlineHHMM);
  return {
    serviceDate,
    deadline,
    open: now.getTime() < deadline.getTime(),
    minutesLeft: Math.floor((deadline.getTime() - now.getTime()) / 60000),
  };
}

module.exports = { isValidDeadline, localDateString, addDays, deadlineInstant, evaluateDeadline };
