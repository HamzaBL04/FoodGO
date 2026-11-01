'use strict';

const { createTestData } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../../src/domain/errors');

test('seed creates the demo restaurants, accounts and memberships', () => {
  const { repos, seed } = createTestData();
  const counts = repos.platform.counts();
  assert.equal(counts.restaurants, 2);
  assert.equal(counts.staff, 2);
  assert.equal(counts.deliveryPersonnel, 3);
  assert.equal(counts.customers, 3);
  assert.equal(repos.restaurants.listItems(seed.darLella.restaurantId).length, 8);
});

test('constraint 3 / D-10: restaurant-scoped queries refuse to run without a scope', () => {
  const { repos } = createTestData();
  assert.throws(() => repos.restaurants.listItems(undefined), AppError);
  assert.throws(() => repos.orders.listForRestaurant('', '2026-11-02'), AppError);
  assert.throws(() => repos.accounts.listDeliveryPersonnel(null), AppError);
});

test('BR-09: a menu item cannot be read through another restaurant scope', () => {
  const { repos, seed } = createTestData();
  const item = seed.darLella.items[0];
  assert.ok(repos.restaurants.findItem(seed.darLella.restaurantId, item.menuItemId));
  assert.equal(repos.restaurants.findItem(seed.kramSnack.restaurantId, item.menuItemId), null);
});

test('D-01: a customer cannot be registered twice at the same restaurant', () => {
  const { repos, seed } = createTestData();
  assert.throws(() =>
    repos.customers.insertMembership({
      restaurantId: seed.darLella.restaurantId,
      customerId: seed.customers.yasmine.customerId,
      credentialRef: 'cred_dup',
      eligible: 1,
      registeredAt: new Date().toISOString(),
      registeredBy: seed.darLella.staffId,
    }),
  );
});

test('BR-04 / BR-16: a customer only lists restaurants that registered them', () => {
  const { repos, seed } = createTestData();
  const forOmar = repos.restaurants.listForCustomer(seed.customers.omar.customerId).map((r) => r.name);
  assert.deepEqual(forOmar, ['Dar Lella']);
  const forYasmine = repos.restaurants.listForCustomer(seed.customers.yasmine.customerId).map((r) => r.name);
  assert.deepEqual(forYasmine, ['Dar Lella', 'Kram Snack']);
});

test('ineligible memberships are not listed (FR-17)', () => {
  const { repos, seed } = createTestData();
  repos.customers.setEligibility(seed.darLella.restaurantId, seed.customers.omar.customerId, false);
  assert.deepEqual(repos.restaurants.listForCustomer(seed.customers.omar.customerId), []);
});

test('unitOfWork rolls back every write when one fails (T1 all-or-nothing)', () => {
  const { repos, seed } = createTestData();
  const before = repos.platform.counts().ordersTotal;
  assert.throws(() =>
    repos.unitOfWork(() => {
      repos.orders.insertOrder({
        orderId: 'FG-ROLLBK',
        customerId: seed.customers.omar.customerId,
        restaurantId: seed.darLella.restaurantId,
        status: 'SUBMITTED',
        totalMillimes: 1000,
        paymentMethod: 'CASH_ON_DELIVERY',
        paymentStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        serviceDate: '2026-11-02',
        deadlineSnapshot: new Date().toISOString(),
      });
      // quantity 0 violates the CHECK constraint -> whole transaction aborts
      repos.orders.insertOrderItem({
        orderItemId: 'oi_x',
        orderId: 'FG-ROLLBK',
        menuItemId: seed.darLella.items[0].menuItemId,
        nameSnapshot: 'x',
        quantity: 0,
        unitPriceMillimes: 1000,
      });
    }),
  );
  assert.equal(repos.platform.counts().ordersTotal, before);
});

test('history seeding produces delivered, paid orders for the forecast', () => {
  const { repos } = createTestData({ historyDays: 14 });
  const counts = repos.platform.counts();
  assert.ok(counts.ordersTotal > 100, `expected >100 historical orders, got ${counts.ordersTotal}`);
});

test('BR-07 / BR-06: the platform stores no delivery equipment or employment data', () => {
  const { db } = createTestData();
  const columns = db.prepare("SELECT name FROM pragma_table_info('delivery_person')").all().map((c) => c.name);
  for (const forbidden of ['vehicle', 'equipment', 'salary', 'shift', 'employer']) {
    assert.equal(columns.some((c) => c.includes(forbidden)), false, forbidden);
  }
  assert.ok(columns.includes('restaurant_id'), 'every delivery person belongs to a restaurant');
});
