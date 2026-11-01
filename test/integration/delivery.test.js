'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

async function placeOrder(app, seed, { method = 'CASH_ON_DELIVERY', phone = DEMO_ACCOUNTS.omar.phone } = {}) {
  const customer = await signInCustomer(request, app, phone);
  const res = await request(app).post('/api/v1/customer/orders').set('Authorization', customer).send({
    restaurantId: seed.darLella.restaurantId,
    items: [{ menuItemId: seed.darLella.items[2].menuItemId, quantity: 2 }],
    paymentMethod: method,
  });
  assert.equal(res.status, 201);
  return { customer, order: res.body.order };
}

async function assign(app, seed, orderId, deliveryPersonId = seed.darLella.couriers.karimId) {
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const res = await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${orderId}/assign`)
    .set('Authorization', staff).send({ deliveryPersonId });
  return { staff, res };
}

test('System scenario (spec §16.3): order -> prepare -> assign -> deliver -> cash recorded', async () => {
  const { app, seed, ctx } = createTestApp();
  const seen = [];
  ctx.components.notifications.subscribe((e) => seen.push(`${e.type}:${e.status || ''}`));

  // 1–4 customer places the morning order
  const { customer, order } = await placeOrder(app, seed);
  // 5–6 restaurant receives and prepares it
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${order.orderId}/start-preparation`)
    .set('Authorization', staff).expect(200);
  // 7 restaurant assigns its own delivery person (BR-10)
  const assigned = await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${order.orderId}/assign`)
    .set('Authorization', staff).send({ deliveryPersonId: seed.darLella.couriers.karimId });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.order.status, 'ASSIGNED');
  assert.equal(assigned.body.order.delivery.deliveryPersonName, 'Karim Dridi');

  // 8 delivery person receives the assignment (BR-08)
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const list = await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim);
  const mine = list.body.assignments.find((a) => a.orderId === order.orderId);
  assert.ok(mine);
  const detail = await request(app).get(`/api/v1/delivery/assignments/${mine.assignmentId}`).set('Authorization', karim);
  assert.equal(detail.body.assignment.customer.destination, 'Lac 2 Tech Park'); // FR-21
  assert.equal(detail.body.assignment.payment.amountToCollect, 13);

  // 9 delivery occurs and is confirmed by the delivery person (BR-11)
  const started = await request(app).post(`/api/v1/delivery/assignments/${mine.assignmentId}/start`).set('Authorization', karim);
  assert.equal(started.body.assignment.order.status, 'OUT_FOR_DELIVERY');
  const done = await request(app).post(`/api/v1/delivery/assignments/${mine.assignmentId}/confirm`).set('Authorization', karim).send({ cashCollected: true });
  assert.equal(done.status, 200);
  assert.equal(done.body.assignment.status, 'COMPLETED');
  assert.equal(done.body.assignment.order.status, 'DELIVERED');

  // 10 payment status recorded and projected onto the order (BR-12, D-03)
  const final = await request(app).get(`/api/v1/customer/orders/${order.orderId}`).set('Authorization', customer);
  assert.equal(final.body.order.status, 'DELIVERED');
  assert.equal(final.body.order.paymentStatus, 'PAID');
  assert.equal(final.body.order.delivery.status, 'COMPLETED');
  const payment = ctx.repos.orders.findCurrentPayment(order.orderId);
  assert.equal(payment.status, final.body.order.paymentStatus, 'I-7: projection equals the payment row');
  assert.equal(payment.providerReference, `CASH-${order.orderId}`);

  assert.deepEqual(seen, [
    'OrderSubmitted:SUBMITTED', 'OrderConfirmed:SUBMITTED', 'OrderStatusChanged:IN_PREPARATION',
    'DeliveryAssigned:ASSIGNED', 'OrderStatusChanged:ASSIGNED',
    'DeliveryStatusChanged:OUT_FOR_DELIVERY', 'OrderStatusChanged:OUT_FOR_DELIVERY',
    'DeliveryStatusChanged:DELIVERED', 'OrderStatusChanged:DELIVERED', 'PaymentStatusChanged:DELIVERED',
  ]);
});

test('I-8 / BR-06: an order cannot be assigned to another restaurant\'s delivery person', async () => {
  const { app, seed } = createTestApp();
  const { order } = await placeOrder(app, seed);
  const { res } = await assign(app, seed, order.orderId, seed.campus.couriers.samiId);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DEL-001');
});

test('an order cannot be assigned twice (re-assignment is unresolved)', async () => {
  const { app, seed } = createTestApp();
  const { order } = await placeOrder(app, seed);
  assert.equal((await assign(app, seed, order.orderId)).res.status, 200);
  const again = await assign(app, seed, order.orderId, seed.darLella.couriers.amineId);
  assert.equal(again.res.status, 409);
});

test('BR-08: a delivery person sees and acts on their own assignments only', async () => {
  const { app, seed } = createTestApp();
  const { order } = await placeOrder(app, seed);
  await assign(app, seed, order.orderId, seed.darLella.couriers.karimId);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const assignmentId = (await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim)).body.assignments[0].assignmentId;

  const amine = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.amine);
  const list = await request(app).get('/api/v1/delivery/assignments').set('Authorization', amine);
  assert.equal(list.body.assignments.length, 0);
  assert.equal((await request(app).get(`/api/v1/delivery/assignments/${assignmentId}`).set('Authorization', amine)).status, 404);
  assert.equal((await request(app).post(`/api/v1/delivery/assignments/${assignmentId}/start`).set('Authorization', amine)).status, 404);
  assert.equal((await request(app).post(`/api/v1/delivery/assignments/${assignmentId}/confirm`).set('Authorization', amine).send({})).status, 404);
});

test('BR-10 / BR-11: delivery must be started before it can be confirmed, and only once', async () => {
  const { app, seed } = createTestApp();
  const { order } = await placeOrder(app, seed);
  await assign(app, seed, order.orderId);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const id = (await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim)).body.assignments[0].assignmentId;
  const early = await request(app).post(`/api/v1/delivery/assignments/${id}/confirm`).set('Authorization', karim).send({ cashCollected: true });
  assert.equal(early.status, 409);
  await request(app).post(`/api/v1/delivery/assignments/${id}/start`).set('Authorization', karim).expect(200);
  const twice = await request(app).post(`/api/v1/delivery/assignments/${id}/start`).set('Authorization', karim);
  assert.equal(twice.status, 409);
  await request(app).post(`/api/v1/delivery/assignments/${id}/confirm`).set('Authorization', karim).send({ cashCollected: true }).expect(200);
  const again = await request(app).post(`/api/v1/delivery/assignments/${id}/confirm`).set('Authorization', karim).send({ cashCollected: true });
  assert.equal(again.status, 409);
});

test('cash not collected: delivery confirmed, payment stays PENDING (follow-up unresolved)', async () => {
  const { app, seed } = createTestApp();
  const { customer, order } = await placeOrder(app, seed);
  await assign(app, seed, order.orderId);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const id = (await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim)).body.assignments[0].assignmentId;
  await request(app).post(`/api/v1/delivery/assignments/${id}/start`).set('Authorization', karim).expect(200);
  await request(app).post(`/api/v1/delivery/assignments/${id}/confirm`).set('Authorization', karim).send({ cashCollected: false }).expect(200);
  const final = await request(app).get(`/api/v1/customer/orders/${order.orderId}`).set('Authorization', customer);
  assert.equal(final.body.order.status, 'DELIVERED');
  assert.equal(final.body.order.paymentStatus, 'PENDING');
});

test('e-payment orders are already paid; confirmation does not change the payment', async () => {
  const { app, seed } = createTestApp();
  const { customer, order } = await placeOrder(app, seed, { method: 'E_PAYMENT' });
  await assign(app, seed, order.orderId);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const id = (await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim)).body.assignments[0].assignmentId;
  const detail = await request(app).get(`/api/v1/delivery/assignments/${id}`).set('Authorization', karim);
  assert.equal(detail.body.assignment.payment.amountToCollect, 0);
  await request(app).post(`/api/v1/delivery/assignments/${id}/start`).set('Authorization', karim).expect(200);
  await request(app).post(`/api/v1/delivery/assignments/${id}/confirm`).set('Authorization', karim).send({}).expect(200);
  const final = await request(app).get(`/api/v1/customer/orders/${order.orderId}`).set('Authorization', customer);
  assert.equal(final.body.order.paymentStatus, 'PAID');
});

test('staff cannot use delivery routes; delivery people cannot assign', async () => {
  const { app, seed } = createTestApp();
  const { order } = await placeOrder(app, seed);
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  assert.equal((await request(app).get('/api/v1/delivery/assignments').set('Authorization', staff)).status, 403);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const res = await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${order.orderId}/assign`)
    .set('Authorization', karim).send({ deliveryPersonId: seed.darLella.couriers.karimId });
  assert.equal(res.status, 403);
});

test('SSE stream: requires sign-in and is closed to administrators', async () => {
  const { app } = createTestApp();
  assert.equal((await request(app).get('/api/v1/events')).status, 401);
  const admin = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  assert.equal((await request(app).get('/api/v1/events').set('Authorization', admin)).status, 403);
});

test('SSE stream delivers only the viewer\'s own events', async () => {
  const { app, seed } = createTestApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const omar = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/events`, { headers: { Authorization: omar }, signal: controller.signal });
    assert.match(res.headers.get('content-type'), /^text\/event-stream/);
    const reader = res.body.getReader();
    // Another customer's order must not appear; Omar's own must.
    await placeOrder(app, seed, { phone: DEMO_ACCOUNTS.yasmine.phone });
    const { order } = await placeOrder(app, seed, { phone: DEMO_ACCOUNTS.omar.phone });
    let text = '';
    while (!text.includes('OrderConfirmed')) {
      const { value } = await reader.read();
      text += Buffer.from(value).toString();
    }
    controller.abort();
    assert.ok(text.includes(order.orderId));
    assert.equal((text.match(/"orderId"/g) || []).length, 2, 'two events, both about Omar\'s order');
  } finally {
    server.close();
  }
});
