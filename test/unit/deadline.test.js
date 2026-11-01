'use strict';

require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDeadline, isValidDeadline, addDays, localDateString } = require('../../src/domain/deadline');
const { toMillimes, fromMillimes, formatTnd } = require('../../src/domain/money');

test('BR-01: a submission before the deadline is open', () => {
  const r = evaluateDeadline(new Date('2026-11-02T08:00:00+01:00'), '10:30');
  assert.equal(r.open, true);
  assert.equal(r.serviceDate, '2026-11-02');
  assert.equal(r.minutesLeft, 150);
});

test('BR-01 / FR-13: a submission after the deadline is closed', () => {
  const r = evaluateDeadline(new Date('2026-11-02T10:31:00+01:00'), '10:30');
  assert.equal(r.open, false);
});

test('U-8: a submission exactly at the deadline is refused', () => {
  const r = evaluateDeadline(new Date('2026-11-02T10:30:00+01:00'), '10:30');
  assert.equal(r.open, false);
});

test('deadline format is validated as HH:MM', () => {
  assert.equal(isValidDeadline('10:30'), true);
  assert.equal(isValidDeadline('24:00'), false);
  assert.equal(isValidDeadline('9:30'), false);
  assert.equal(isValidDeadline(null), false);
});

test('date helpers work across month boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(localDateString(new Date('2026-11-02T23:30:00+01:00')), '2026-11-02');
});

test('money is exact in millimes', () => {
  assert.equal(toMillimes(14.5), 14500);
  assert.equal(toMillimes('3.5'), 3500);
  assert.equal(fromMillimes(29000), 29);
  assert.equal(formatTnd(6500), '6.500 TND');
  // 0.1 + 0.2 style errors cannot happen with integer millimes
  assert.equal(toMillimes(0.1) + toMillimes(0.2), toMillimes(0.3));
});
