'use strict';

require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { transition, canTransition, allowedNext, labelOf, ORDER_STATUS: S } = require('../../src/domain/orderState');
const { CashOnDeliveryStrategy, EPaymentStrategy } = require('../../src/components/paymentComponent');
const { createSandboxPaymentAdapter } = require('../../src/adapters/paymentAdapter');
const { visibleTo, createNotificationComponent } = require('../../src/components/notificationComponent');
const { AppError } = require('../../src/domain/errors');

const courier = { role: 'DELIVERY', subjectId: 'dlv_1' };
const assignment = (status = 'ASSIGNED') => ({ deliveryPersonId: 'dlv_1', status });

test('happy path transitions are allowed', () => {
  assert.equal(transition(S.SUBMITTED, S.IN_PREPARATION), S.IN_PREPARATION);
  assert.equal(transition(S.IN_PREPARATION, S.ASSIGNED, { assignment: assignment() }), S.ASSIGNED);
  assert.equal(transition(S.ASSIGNED, S.OUT_FOR_DELIVERY, { assignment: assignment('STARTED') }), S.OUT_FOR_DELIVERY);
  assert.equal(transition(S.OUT_FOR_DELIVERY, S.DELIVERED, { assignment: assignment('STARTED'), actor: courier }), S.DELIVERED);
});

test('illegal transitions are inexpressible (BR-14)', () => {
  assert.throws(() => transition(S.SUBMITTED, S.DELIVERED), AppError);
  assert.throws(() => transition(S.DELIVERED, S.SUBMITTED), AppError);
  assert.throws(() => transition('CANCELLED', S.SUBMITTED), AppError, 'unresolved states do not exist');
  assert.equal(canTransition(S.DELIVERED, S.OUT_FOR_DELIVERY), false);
});

test('BR-10 / I-9: no assignment, no dispatch', () => {
  assert.throws(() => transition(S.IN_PREPARATION, S.ASSIGNED, {}), /BR-10/);
  assert.throws(() => transition(S.ASSIGNED, S.OUT_FOR_DELIVERY, { assignment: assignment('ASSIGNED') }), /BR-10/);
});

test('BR-11: only the assigned delivery person can confirm delivery', () => {
  const ctx = { assignment: assignment('STARTED'), actor: { role: 'DELIVERY', subjectId: 'dlv_2' } };
  assert.throws(() => transition(S.OUT_FOR_DELIVERY, S.DELIVERED, ctx), /BR-11/);
  assert.throws(() => transition(S.OUT_FOR_DELIVERY, S.DELIVERED, { assignment: assignment('STARTED'), actor: { role: 'STAFF', subjectId: 'dlv_1' } }), /BR-11/);
});

test('labels and allowed next states', () => {
  assert.deepEqual(allowedNext(S.SUBMITTED), ['IN_PREPARATION', 'ASSIGNED']);
  assert.deepEqual(allowedNext(S.DELIVERED), []);
  assert.equal(labelOf(S.OUT_FOR_DELIVERY), 'On the way');
  assert.equal(labelOf('UNKNOWN'), 'UNKNOWN');
});

test('Strategy: cash is pending at checkout and paid only when collected', () => {
  const s = new CashOnDeliveryStrategy();
  assert.deepEqual(s.atCheckout(), { status: 'PENDING', providerReference: null });
  assert.equal(s.atDelivery({ order: { orderId: 'FG-1' }, cashCollected: false }), null);
  assert.deepEqual(s.atDelivery({ order: { orderId: 'FG-1' }, cashCollected: true }), { status: 'PAID', providerReference: 'CASH-FG-1' });
});

test('Strategy: e-payment captures through the adapter at checkout', () => {
  const adapter = createSandboxPaymentAdapter();
  const s = new EPaymentStrategy(adapter);
  const r = s.atCheckout({ order: { orderId: 'FG-2', totalMillimes: 14500 } });
  assert.equal(r.status, 'PAID');
  assert.match(r.providerReference, /^DEMOPAY-FG-2-/);
  assert.equal(s.atDelivery(), null);
  adapter.failNextCapture();
  assert.throws(() => s.atCheckout({ order: { orderId: 'FG-3', totalMillimes: 100 } }), /declined/);
  adapter.setAvailable(false);
  assert.throws(() => s.atCheckout({ order: { orderId: 'FG-4', totalMillimes: 100 } }), (e) => e.code === 'PAY-002');
  adapter.setAvailable(true);
  assert.throws(() => s.atCheckout({ order: { orderId: 'FG-5', totalMillimes: 0 } }), (e) => e.code === 'PAY-001');
});

test('BR-15: event visibility per role', () => {
  const e = { type: 'OrderStatusChanged', orderId: 'FG-1', customerId: 'c1', restaurantId: 'r1', deliveryPersonId: 'd1' };
  assert.equal(visibleTo({ role: 'CUSTOMER', subjectId: 'c1' }, e), true);
  assert.equal(visibleTo({ role: 'CUSTOMER', subjectId: 'c2' }, e), false);
  assert.equal(visibleTo({ role: 'STAFF', restaurantId: 'r1' }, e), true);
  assert.equal(visibleTo({ role: 'STAFF', restaurantId: 'r2' }, e), false);
  assert.equal(visibleTo({ role: 'DELIVERY', subjectId: 'd1' }, e), true);
  assert.equal(visibleTo({ role: 'DELIVERY', subjectId: 'd1' }, { ...e, deliveryPersonId: undefined }), false);
  assert.equal(visibleTo({ role: 'ADMIN', subjectId: 'a' }, e), false);
  assert.equal(visibleTo(null, e), false);
});

test('Observer: a failing listener never breaks publishing', () => {
  const errors = [];
  const notes = createNotificationComponent({ notificationAdapter: { notify: () => {} }, logger: { error: (m) => errors.push(m) } });
  const seen = [];
  notes.subscribe(() => {
    throw new Error('boom');
  });
  notes.subscribe((ev) => seen.push(ev.type));
  notes.publish('OrderSubmitted', { orderId: 'FG-1' });
  assert.deepEqual(seen, ['OrderSubmitted']);
  assert.equal(errors.length, 1);
});
