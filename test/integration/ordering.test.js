'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

function items(seed, restaurant = 'darLella') {
  const it = seed[restaurant].items;
  return [{ menuItemId: it[0].menuItemId, quantity: 2 }, { menuItemId: it[4].menuItemId, quantity: 3 }];
}

async function submit(app, auth, body, headers = {}) {
  let req = request(app).post('/api/v1/customer/orders').set('Authorization', auth);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return req.send(body);
}

test('UC-01 / FR-09–FR-11, FR-14: a customer places a cash pre-order; total and confirmation are correct', async () => {
  const { app, seed, ctx } = createTestApp();
  const events = [];
  ctx.components.notifications.subscribe((e) => events.push(e.type));
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  assert.equal(res.status, 201);
  const o = res.body.order;
  assert.match(o.orderId, /^FG-[2-9A-Z]{6}$/); // FR-14
  // 2 x 14.500 couscous + 3 x 3.500 brik = 39.500 (FR-11)
  assert.equal(o.total, 39.5);
  assert.equal(o.status, 'SUBMITTED');
  assert.equal(o.paymentStatus, 'PENDING');
  assert.equal(o.items.length, 2);
  assert.deepEqual(events, ['OrderSubmitted', 'OrderConfirmed']);

  // FR-24: the customer sees it in their own list
  const mine = await request(app).get('/api/v1/customer/orders').set('Authorization', auth);
  assert.equal(mine.body.orders[0].orderId, o.orderId);
});

test('BR-12 / FR-28 / I-3: every order has a payment row created with it', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  const payment = ctx.repos.orders.findCurrentPayment(res.body.order.orderId);
  assert.equal(payment.method, 'CASH_ON_DELIVERY');
  assert.equal(payment.status, 'PENDING');
  assert.equal(payment.amountMillimes, 39500);
});

test('FR-25, FR-27, FR-28, BR-13: e-payment is captured at checkout and projected onto the order (D-03)', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'E_PAYMENT' });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.paymentStatus, 'PAID');
  const payment = ctx.repos.orders.findCurrentPayment(res.body.order.orderId);
  assert.equal(payment.status, 'PAID');
  assert.match(payment.providerReference, /^DEMOPAY-/);
});

test('PAY-001: a declined e-payment rolls back the whole order (T1)', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const before = ctx.repos.platform.counts().ordersTotal;
  const events = [];
  ctx.components.notifications.subscribe((e) => events.push(e.type));
  ctx.adapters.payment.failNextCapture();
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'E_PAYMENT' });
  assert.equal(res.status, 402);
  assert.equal(res.body.error.code, 'PAY-001');
  assert.equal(ctx.repos.platform.counts().ordersTotal, before, 'no half-written order');
  assert.deepEqual(events, [], 'no notification for an order that does not exist (D-08)');
});

test('PAY-002: provider unavailable', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  ctx.adapters.payment.setAvailable(false);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'E_PAYMENT' });
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'PAY-002');
});

test('BR-01 / FR-12 / FR-13: orders before the deadline are accepted, after it refused with ORDER-001', async () => {
  const { app, seed, clock } = createTestApp(); // 08:00, Kram Snack closes 10:30
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.nour.phone);
  const body = { restaurantId: seed.kramSnack.restaurantId, items: items(seed, 'kramSnack'), paymentMethod: 'CASH_ON_DELIVERY' };
  clock.set('2026-11-02T10:29:00+01:00');
  assert.equal((await submit(app, auth, body)).status, 201, 'FR-12: accepted before the deadline');
  clock.set('2026-11-02T10:30:00+01:00');
  const late = await submit(app, auth, body);
  assert.equal(late.status, 409);
  assert.equal(late.body.error.code, 'ORDER-001');
});

test('D-04: changing the deadline does not change an order already placed', async () => {
  const { app, seed } = createTestApp();
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.nour.phone);
  const placed = await submit(app, customer, { restaurantId: seed.kramSnack.restaurantId, items: items(seed, 'kramSnack'), paymentMethod: 'CASH_ON_DELIVERY' });
  const snapshot = placed.body.order.deadlineSnapshot;
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.kramSnackStaff);
  await request(app).put(`/api/v1/restaurants/${seed.kramSnack.restaurantId}/settings`).set('Authorization', staff)
    .send({ orderingDeadline: '07:00', cashOnDeliveryEnabled: true, ePaymentEnabled: true }).expect(200);
  const again = await request(app).get(`/api/v1/customer/orders/${placed.body.order.orderId}`).set('Authorization', customer);
  assert.equal(again.body.order.deadlineSnapshot, snapshot);
  // ...but new orders now follow the new deadline
  const late = await submit(app, customer, { restaurantId: seed.kramSnack.restaurantId, items: items(seed, 'kramSnack'), paymentMethod: 'CASH_ON_DELIVERY' });
  assert.equal(late.body.error.code, 'ORDER-001');
});

test('BR-02: an unavailable item cannot be ordered (ORDER-002)', async () => {
  const { app, seed } = createTestApp();
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const item = seed.darLella.items[0];
  await request(app).patch(`/api/v1/restaurants/${seed.darLella.restaurantId}/menu/items/${item.menuItemId}`)
    .set('Authorization', staff).send({ available: false }).expect(200);
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER-002');
});

test('D-02: a later price change never alters a placed order', async () => {
  const { app, seed } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const placed = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  await request(app).patch(`/api/v1/restaurants/${seed.darLella.restaurantId}/menu/items/${seed.darLella.items[0].menuItemId}`)
    .set('Authorization', staff).send({ price: 99 }).expect(200);
  const after = await request(app).get(`/api/v1/customer/orders/${placed.body.order.orderId}`).set('Authorization', auth);
  assert.equal(after.body.order.total, 39.5);
  assert.equal(after.body.order.items.find((i) => i.name === 'Couscous au poulet').unitPrice, 14.5);
});

test('I-5: an item from another restaurant cannot be added to the order', async () => {
  const { app, seed } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const res = await submit(app, auth, {
    restaurantId: seed.darLella.restaurantId,
    items: [{ menuItemId: seed.kramSnack.items[0].menuItemId, quantity: 1 }],
    paymentMethod: 'CASH_ON_DELIVERY',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VAL-001');
});

test('BR-04 / BR-16: a customer cannot order from a restaurant that did not register them', async () => {
  const { app, seed } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.kramSnack.restaurantId, items: items(seed, 'kramSnack'), paymentMethod: 'CASH_ON_DELIVERY' });
  assert.equal(res.status, 403);
});

test('FR-26: a disabled payment method is refused', async () => {
  const { app, seed } = createTestApp();
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  await request(app).put(`/api/v1/restaurants/${seed.darLella.restaurantId}/settings`).set('Authorization', staff)
    .send({ orderingDeadline: '23:30', cashOnDeliveryEnabled: false, ePaymentEnabled: true }).expect(200);
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await submit(app, auth, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  assert.equal(res.status, 400);
});

test('FR-10 validation: empty cart, zero quantity and repeated lines', async () => {
  const { app, seed } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const rid = seed.darLella.restaurantId;
  const item = seed.darLella.items[2];
  assert.equal((await submit(app, auth, { restaurantId: rid, items: [], paymentMethod: 'CASH_ON_DELIVERY' })).status, 400);
  assert.equal((await submit(app, auth, { restaurantId: rid, items: [{ menuItemId: item.menuItemId, quantity: 0 }], paymentMethod: 'CASH_ON_DELIVERY' })).status, 400);
  const merged = await submit(app, auth, {
    restaurantId: rid,
    items: [{ menuItemId: item.menuItemId, quantity: 1 }, { menuItemId: item.menuItemId, quantity: 2 }],
    paymentMethod: 'CASH_ON_DELIVERY',
  });
  assert.equal(merged.body.order.items.length, 1);
  assert.equal(merged.body.order.items[0].quantity, 3);
  const tooMany = await submit(app, auth, {
    restaurantId: rid,
    items: [{ menuItemId: item.menuItemId, quantity: 30 }, { menuItemId: item.menuItemId, quantity: 30 }],
    paymentMethod: 'CASH_ON_DELIVERY',
  });
  assert.equal(tooMany.status, 400);
});

test('duplicate-submission protection: same Idempotency-Key returns the same order', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const body = { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' };
  const first = await submit(app, auth, body, { 'Idempotency-Key': 'checkout-1234-abcd' });
  const retry = await submit(app, auth, body, { 'Idempotency-Key': 'checkout-1234-abcd' });
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.order.orderId, first.body.order.orderId);
  assert.equal(ctx.repos.platform.counts().ordersTotal, 1);
  const bad = await submit(app, auth, body, { 'Idempotency-Key': 'x' });
  assert.equal(bad.status, 400);
});

test('FR-15 / BR-09: the order appears in its restaurant queue only', async () => {
  const { app, seed } = createTestApp();
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const placed = await submit(app, customer, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  const lella = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const queue = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders`).set('Authorization', lella);
  assert.equal(queue.body.orders.length, 1);
  assert.equal(queue.body.orders[0].orderId, placed.body.order.orderId);
  assert.equal(queue.body.orders[0].customer.organizationName, 'Lac 3 Business Tower'); // FR-16
  const kramSnack = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.kramSnackStaff);
  const other = await request(app).get(`/api/v1/restaurants/${seed.kramSnack.restaurantId}/orders`).set('Authorization', kramSnack);
  assert.equal(other.body.orders.length, 0);
  const sneaky = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders`).set('Authorization', kramSnack);
  assert.equal(sneaky.status, 403);
});

test('a customer cannot read another customer\'s order', async () => {
  const { app, seed } = createTestApp();
  const yasmine = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const placed = await submit(app, yasmine, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  const omar = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await request(app).get(`/api/v1/customer/orders/${placed.body.order.orderId}`).set('Authorization', omar);
  assert.equal(res.status, 404);
});

test('restaurant moves an order into preparation; illegal repeats are refused', async () => {
  const { app, seed, ctx } = createTestApp();
  const events = [];
  ctx.components.notifications.subscribe((e) => events.push(`${e.type}:${e.status}`));
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const placed = await submit(app, customer, { restaurantId: seed.darLella.restaurantId, items: items(seed), paymentMethod: 'CASH_ON_DELIVERY' });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const url = `/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${placed.body.order.orderId}/start-preparation`;
  const res = await request(app).post(url).set('Authorization', staff);
  assert.equal(res.status, 200);
  assert.equal(res.body.order.status, 'IN_PREPARATION');
  assert.ok(events.includes('OrderStatusChanged:IN_PREPARATION'));
  const again = await request(app).post(url).set('Authorization', staff);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'DEL-001');
  const missing = await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/FG-NOPE22/start-preparation`).set('Authorization', staff);
  assert.equal(missing.status, 404);
});

test('restaurant queue can be filtered by service date', async () => {
  const { app, seed } = createTestApp({ historyDays: 7 });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const res = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders?date=2026-10-31`).set('Authorization', staff);
  assert.ok(res.body.orders.length > 5);
  assert.ok(res.body.orders.every((o) => o.serviceDate === '2026-10-31' && o.status === 'DELIVERED'));
});
