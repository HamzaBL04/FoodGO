'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, ERROR_CODES } = require('../../src/domain/errors');
const { fixedClock } = require('../../src/domain/clock');

test('AppError maps a specification code to its HTTP status', () => {
  const err = new AppError('ORDER-001');
  assert.equal(err.code, 'ORDER-001');
  assert.equal(err.status, 409);
  assert.deepEqual(err.toJSON(), { error: { code: 'ORDER-001', message: 'Ordering deadline passed' } });
});

test('AppError keeps a custom safe detail', () => {
  const err = new AppError('VAL-001', 'quantity must be at least 1');
  assert.equal(err.status, 400);
  assert.equal(err.detail, 'quantity must be at least 1');
});

test('unknown codes fall back to SYS-001 instead of leaking', () => {
  const err = new AppError('NOPE');
  assert.equal(err.code, 'SYS-001');
  assert.equal(err.status, 500);
});

test('every specification error code from §14.2 is present', () => {
  for (const code of ['AUTH-001', 'AUTH-002', 'VAL-001', 'ORDER-001', 'ORDER-002', 'ORDER-003', 'PAY-001', 'PAY-002', 'DEL-001', 'SYS-001']) {
    assert.ok(ERROR_CODES[code], code);
  }
});

test('fixedClock is deterministic and can advance', () => {
  const clock = fixedClock('2026-11-02T08:00:00+01:00');
  const t0 = clock.now();
  clock.advanceMinutes(30);
  assert.equal(clock.now().getTime() - t0.getTime(), 30 * 60000);
});
