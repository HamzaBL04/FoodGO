'use strict';

require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthComponent } = require('../../src/components/auth');
const { createCustomerComponent } = require('../../src/components/customerComponent');
const { createPaymentComponent } = require('../../src/components/paymentComponent');
const { createDeliveryManagement } = require('../../src/components/deliveryManagement');
const { createRestaurantManagement } = require('../../src/components/restaurantManagement');
const { menuItemView, paymentMethodsFor, restaurantSettingsView } = require('../../src/components/presenters');
const { fixedClock } = require('../../src/domain/clock');
const { sha256 } = require('../../src/domain/ids');

// Unit tests: each component in isolation, with hand-written fakes instead of
// the database. Integration tests in test/integration cover the real wiring.

const clock = fixedClock('2026-11-02T08:00:00+01:00');
const config = { bcryptRounds: 4, sessionTtlHours: 12, otpTtlMinutes: 5, otpMaxAttempts: 5, demoMode: false };

function fakePlatform() {
  const sessions = new Map();
  const audits = [];
  return {
    audits,
    insertSession: (s) => sessions.set(s.tokenHash, s),
    findSession: (h, now) => {
      const s = sessions.get(h);
      return s && s.expiresAt > now ? s : null;
    },
    deleteSession: (h) => sessions.delete(h),
    audit: (e) => audits.push(e),
    insertOtp: () => {},
  };
}

test('auth (unit): demo mode off never returns the code, and SMS is sent through the adapter', () => {
  const sent = [];
  const repos = {
    customers: {
      findCustomerByPhone: () => ({ customerId: 'c1', status: 'ACTIVE', fullName: 'X' }),
      activeRestaurantIdsForCustomer: () => ['r1'],
    },
    platform: fakePlatform(),
  };
  const auth = createAuthComponent({ repos, clock, sms: { send: (to, m) => sent.push({ to, m }) }, config });
  const res = auth.requestOtp({ phoneNumber: '+21698333444' });
  assert.equal(res.demoCode, undefined);
  assert.match(sent[0].m, /FoodGO code: \d{6}/);
});

test('auth (unit): sessions are stored as hashes and resolve to a principal until they expire', () => {
  const platform = fakePlatform();
  const hashOf = (pw) => require('bcryptjs').hashSync(pw, 4);
  const repos = {
    accounts: { findStaffByIdentity: () => ({ staffId: 's1', restaurantId: 'r1', fullName: 'S', credentialHash: hashOf('pw-12345'), status: 'ACTIVE' }) },
    platform,
  };
  const c = fixedClock('2026-11-02T08:00:00+01:00');
  const auth = createAuthComponent({ repos, clock: c, sms: { send() {} }, config });
  const { token } = auth.signInWithPassword({ role: 'STAFF', identity: 's@x.tn', password: 'pw-12345' });
  assert.ok(platform.findSession(sha256(token), c.now().toISOString()), 'only the hash is the key');
  assert.deepEqual(auth.authenticate(token), { role: 'STAFF', subjectId: 's1', restaurantId: 'r1' });
  assert.equal(auth.authenticate(null), null);
  c.advanceMinutes(12 * 60 + 1);
  assert.equal(auth.authenticate(token), null);
  assert.throws(() => auth.signInWithPassword({ role: 'STAFF', identity: 's@x.tn', password: 'wrong' }), (e) => e.code === 'AUTH-001');
  assert.equal(platform.audits.at(-1).action, 'AUTH_FAILED');
});

test('customer (unit): membership must be active and eligible (BR-04, BR-16)', () => {
  const membership = { status: 'ACTIVE', eligible: 1 };
  const repos = { customers: { findMembership: () => membership } };
  const customer = createCustomerComponent({ repos, clock });
  assert.equal(customer.assertMembership('c1', 'r1'), membership);
  membership.eligible = 0;
  assert.throws(() => customer.assertMembership('c1', 'r1'), (e) => e.code === 'AUTH-002');
  repos.customers.findMembership = () => null;
  assert.throws(() => customer.assertMembership('c1', 'r1'), (e) => e.code === 'AUTH-002');
});

test('payment (unit): only enabled methods are accepted; cash is paid only when collected (FR-26, FR-28)', () => {
  const updates = [];
  const repos = {
    orders: {
      findCurrentPayment: () => ({ paymentId: 'p1', orderId: 'FG-1' }),
      updatePaymentAndProject: (p, status, ref) => updates.push({ status, ref }),
      insertPayment: () => {},
    },
  };
  const payments = createPaymentComponent({ repos, clock, paymentAdapter: { capture: () => ({ providerReference: 'R' }) } });
  assert.doesNotThrow(() => payments.assertMethodAvailable({ cashOnDeliveryEnabled: 1, ePaymentEnabled: 0 }, 'CASH_ON_DELIVERY'));
  assert.throws(() => payments.assertMethodAvailable({ cashOnDeliveryEnabled: 1, ePaymentEnabled: 0 }, 'E_PAYMENT'), (e) => e.code === 'VAL-001');
  assert.throws(() => payments.resolveStrategy('BITCOIN'), (e) => e.code === 'VAL-001');
  const order = { orderId: 'FG-1', paymentMethod: 'CASH_ON_DELIVERY', totalMillimes: 5000 };
  assert.equal(payments.recordAtDelivery(order, { cashCollected: false }), null);
  assert.equal(payments.recordAtDelivery(order, { cashCollected: true }), 'PAID');
  assert.deepEqual(updates, [{ status: 'PAID', ref: 'CASH-FG-1' }]);
  assert.equal(payments.recordAtCheckout({ ...order, paymentMethod: 'E_PAYMENT' }), 'PAID');
});

test('delivery (unit): an order cannot go to another restaurant\'s courier or be assigned twice (I-8)', () => {
  const orders = { restaurantOrderOrThrow: () => ({ orderId: 'FG-1', restaurantId: 'r1', status: 'SUBMITTED' }) };
  const repos = {
    accounts: { findDeliveryPerson: (rid, id) => (id === 'mine' ? { status: 'ACTIVE' } : null) },
    orders: { findAssignmentForOrder: () => null },
  };
  const dm = createDeliveryManagement({ repos, clock, orders, payments: {}, notifications: { publish() {} } });
  const staff = { role: 'STAFF', subjectId: 's1' };
  assert.throws(() => dm.assignOrder(staff, 'r1', 'FG-1', 'theirs'), /does not work for your restaurant/);
  repos.orders.findAssignmentForOrder = () => ({ assignmentId: 'a1' });
  assert.throws(() => dm.assignOrder(staff, 'r1', 'FG-1', 'mine'), /already assigned/);
});

test('delivery (unit): a courier cannot confirm before starting, nor act on someone else\'s assignment', () => {
  const repos = { orders: { findAssignmentForPerson: (rid, pid, aid) => (aid === 'a1' ? { assignmentId: 'a1', status: 'ASSIGNED', restaurantId: 'r1' } : null) } };
  const dm = createDeliveryManagement({ repos, clock, orders: {}, payments: {}, notifications: { publish() {} } });
  const courier = { role: 'DELIVERY', subjectId: 'd1', restaurantId: 'r1' };
  assert.throws(() => dm.confirmDelivery(courier, 'a1', { cashCollected: true }), /Start the delivery/);
  assert.throws(() => dm.startDelivery(courier, 'a9'), (e) => e.code === 'NOT-FOUND');
});

test('restaurant management (unit): at least one payment method must stay enabled (BR-12)', () => {
  const repos = { restaurants: { findById: () => ({ restaurantId: 'r1' }) } };
  const rm = createRestaurantManagement({ repos, clock, auth: {}, sms: { send() {} } });
  assert.throws(
    () => rm.updateSettings({ role: 'STAFF', subjectId: 's' }, 'r1', { orderingDeadline: '10:30', cashOnDeliveryEnabled: false, ePaymentEnabled: false }),
    /At least one payment method/,
  );
});

test('presenters (unit): never expose internal flags; money converted to TND', () => {
  assert.deepEqual(menuItemView({ menuItemId: 'i', name: 'Lablabi', description: 'd', priceMillimes: 6500, available: 0, removed: 0 }),
    { menuItemId: 'i', name: 'Lablabi', description: 'd', price: 6.5, priceMillimes: 6500, available: false });
  assert.deepEqual(paymentMethodsFor({ cashOnDeliveryEnabled: 0, ePaymentEnabled: 1 }), ['E_PAYMENT']);
  const v = restaurantSettingsView({ restaurantId: 'r', name: 'n', address: null, orderingDeadline: '10:30', cashOnDeliveryEnabled: 1, ePaymentEnabled: 1, accessRules: 'x' });
  assert.equal(v.accessRules, undefined);
  assert.deepEqual(v.paymentMethods, ['CASH_ON_DELIVERY', 'E_PAYMENT']);
});

test('config: demo mode defaults to off in production', () => {
  const { execFileSync } = require('node:child_process');
  const read = (env) => execFileSync(process.execPath, ['-e', "process.stdout.write(String(require('./src/config').demoMode))"], { env: { ...process.env, FOODGO_DEMO_MODE: '', ...env }, cwd: require('node:path').join(__dirname, '..', '..') }).toString();
  assert.equal(read({ NODE_ENV: 'production' }), 'false');
  assert.equal(read({ NODE_ENV: 'development' }), 'true');
  assert.equal(read({ NODE_ENV: 'production', FOODGO_DEMO_MODE: 'true' }), 'true');
});
