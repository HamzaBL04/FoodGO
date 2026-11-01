'use strict';

const { createTestApp, createTestData, signIn, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createAuditor } = require('../../src/components/audit');

function plan(db, sql, ...params) {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params).map((r) => r.detail).join(' | ');
}

test('migration 002: hot restaurant-scoped queries use indexes, not table scans', () => {
  const { db } = createTestData();
  assert.match(plan(db, 'SELECT * FROM orders WHERE restaurant_id = ? AND service_date = ?', 'r', 'd'), /USING INDEX ix_orders_restaurant_day/);
  assert.match(plan(db, 'SELECT * FROM order_item WHERE order_id = ?', 'o'), /USING INDEX ix_order_item_order/);
  assert.match(plan(db, 'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', 'c'), /USING INDEX ix_orders_customer_created/);
  assert.match(plan(db, 'SELECT * FROM delivery_assignment WHERE delivery_person_id = ? AND restaurant_id = ?', 'd', 'r'), /USING INDEX ix_assignment_person/);
});

test('N+1 removed: the order board runs a constant number of queries whatever the order count', async () => {
  const { app, seed, ctx } = createTestApp({ historyDays: 7 });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  // Spy on the per-order loaders the first version called once per order.
  let perOrderCalls = 0;
  for (const name of ['listItems', 'findAssignmentForOrder']) {
    const fn = ctx.repos.orders[name];
    ctx.repos.orders[name] = (...a) => {
      perOrderCalls += 1;
      return fn(...a);
    };
  }
  const res = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders?date=2026-10-31`).set('Authorization', staff);
  assert.ok(res.body.orders.length > 5);
  assert.equal(perOrderCalls, 0, 'no per-order item or assignment queries');
});

test('batched views equal the per-order views', async () => {
  const { ctx, seed } = createTestApp({ historyDays: 3 });
  const orders = ctx.repos.orders.listForRestaurant(seed.darLella.restaurantId, '2026-10-31');
  const batched = ctx.components.orders.listRestaurantOrders(seed.darLella.restaurantId, '2026-10-31');
  orders.forEach((o, i) => {
    const single = ctx.components.orders.orderView(o);
    assert.deepEqual(batched[i].items, single.items);
    assert.deepEqual(batched[i].delivery, single.delivery);
  });
});

test('shared auditor writes one normalised audit row', () => {
  const rows = [];
  const audit = createAuditor({ repos: { platform: { audit: (r) => rows.push(r) } }, clock: { now: () => new Date('2026-11-02T08:00:00Z') } });
  audit({ role: 'STAFF', subjectId: 'stf_1' }, { restaurantId: 'r1', action: 'X', detail: { a: 1 } });
  audit({ role: 'ADMIN', subjectId: 'adm' }, { action: 'Y', detail: 'plain' });
  assert.deepEqual(rows[0], { at: '2026-11-02T08:00:00.000Z', actorRole: 'STAFF', actorId: 'stf_1', restaurantId: 'r1', action: 'X', entity: null, entityId: null, detail: '{"a":1}' });
  assert.equal(rows[1].detail, 'plain');
  assert.equal(rows[1].restaurantId, null);
});

test('a single order is returned without loading the whole board', async () => {
  const { ctx, seed } = createTestApp({ historyDays: 3 });
  const [o] = ctx.repos.orders.listForRestaurant(seed.darLella.restaurantId, '2026-10-31');
  let boardLoads = 0;
  const original = ctx.repos.orders.listForRestaurant;
  ctx.repos.orders.listForRestaurant = (...a) => { boardLoads += 1; return original(...a); };
  const entry = ctx.components.orders.getRestaurantOrder(seed.darLella.restaurantId, o.orderId);
  assert.equal(entry.orderId, o.orderId);
  assert.equal(boardLoads, 0);
  assert.throws(() => ctx.components.orders.getRestaurantOrder(seed.darLella.restaurantId, 'FG-NONE22'), /not found/i);
});
