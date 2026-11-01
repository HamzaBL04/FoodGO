'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

// FR-32 / BR-17 (ADR-0007): FoodGO operates only in Lac 3 and
// Zone Industrielle Le Kram.

const order = (seed) => ({
  restaurantId: seed.darLella.restaurantId,
  items: [{ menuItemId: seed.darLella.items[0].menuItemId, quantity: 1 }],
  paymentMethod: 'CASH_ON_DELIVERY',
});

test('FR-32: a restaurant cannot be created without a zone, or outside the service area', async () => {
  const { app } = createTestApp();
  const admin = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  const post = (body) => request(app).post('/api/v1/admin/restaurants').set('Authorization', admin).send(body);

  const missing = await post({ name: 'No Zone Grill', orderingDeadline: '10:00' });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'VAL-001');

  const outside = await post({ name: 'Ennasr Grill', orderingDeadline: '10:00', serviceZone: 'ENNASR' });
  assert.equal(outside.status, 400);
  assert.equal(outside.body.error.code, 'VAL-001');

  const inside = await post({ name: 'Lac 3 Grill', orderingDeadline: '10:00', serviceZone: 'LAC_3' });
  assert.equal(inside.status, 201);
  assert.equal(inside.body.restaurant.serviceZone, 'LAC_3');
});

test('FR-32: staff can add a workplace only inside the service area', async () => {
  const { app, seed } = createTestApp();
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const post = (body) => request(app).post('/api/v1/organizations').set('Authorization', staff).send(body);

  assert.equal((await post({ name: 'Ennasr Offices', type: 'WORKPLACE' })).status, 400);
  assert.equal((await post({ name: 'Ennasr Offices', type: 'WORKPLACE', serviceZone: 'ENNASR' })).status, 400);

  const created = await post({ name: 'Kram Port Logistics', type: 'WORKPLACE', serviceZone: 'ZI_KRAM' });
  assert.equal(created.status, 201);
  assert.equal(created.body.organization.serviceZone, 'ZI_KRAM');
  const list = await request(app).get('/api/v1/organizations').set('Authorization', staff);
  assert.ok(list.body.organizations.every((o) => ['Lac 3', 'Zone Industrielle Le Kram'].includes(o.zone)));
  const members = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/customers`).set('Authorization', staff);
  assert.ok(members.body.customers.every((c) => c.organizationZone));
});

test('FR-32: the database itself refuses a zone outside the service area', () => {
  const { ctx } = createTestApp();
  assert.throws(
    () => ctx.repos.customers.insertOrganization({ organizationId: 'org_x', name: 'Elsewhere', type: 'WORKPLACE', serviceZone: 'SOUSSE' }),
    /CHECK constraint failed/,
  );
});

test('BR-17: an order from a workplace with no zone is refused (ORDER-003)', async () => {
  const { app, seed, db } = createTestApp();
  // A workplace created before migration 003 has no zone.
  db.prepare('UPDATE organization SET service_zone = NULL WHERE organization_id = ?').run(seed.orgs.lac3TechHub.organizationId);
  const omar = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await request(app).post('/api/v1/customer/orders').set('Authorization', omar).send(order(seed));
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ORDER-003');
  assert.match(res.body.error.message, /Lac 3 and Zone Industrielle Le Kram/);
});

test('BR-17: an order to a restaurant with no zone is refused (ORDER-003)', async () => {
  const { app, seed, db } = createTestApp();
  db.prepare('UPDATE restaurant SET service_zone = NULL WHERE restaurant_id = ?').run(seed.darLella.restaurantId);
  const omar = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await request(app).post('/api/v1/customer/orders').set('Authorization', omar).send(order(seed));
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'ORDER-003');
});

test('BR-17: orders inside the service area go through, across both zones', async () => {
  const { app, seed } = createTestApp();
  // Nour works in ZI Le Kram and orders from Kram Snack.
  const nour = await signInCustomer(request, app, DEMO_ACCOUNTS.nour.phone);
  const res = await request(app).post('/api/v1/customer/orders').set('Authorization', nour).send({
    restaurantId: seed.kramSnack.restaurantId,
    items: [{ menuItemId: seed.kramSnack.items[0].menuItemId, quantity: 1 }],
    paymentMethod: 'CASH_ON_DELIVERY',
  });
  assert.equal(res.status, 201);
});

test('FR-32: zones are shown to customers, staff and delivery people', async () => {
  const { app, seed } = createTestApp();
  const yasmine = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const list = await request(app).get('/api/v1/customer/restaurants').set('Authorization', yasmine);
  const zones = Object.fromEntries(list.body.restaurants.map((r) => [r.name, r.zone]));
  assert.deepEqual(zones, { 'Dar Lella': 'Lac 3', 'Kram Snack': 'Zone Industrielle Le Kram' });
  const me = await request(app).get('/api/v1/customer/me').set('Authorization', yasmine);
  assert.equal(me.body.profile.organization.zone, 'Lac 3');

  const placed = await request(app).post('/api/v1/customer/orders').set('Authorization', yasmine).send(order(seed));
  assert.equal(placed.status, 201);
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const queue = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders`).set('Authorization', staff);
  assert.equal(queue.body.orders[0].customer.organizationZone, 'Lac 3');

  const orderId = placed.body.order.orderId;
  await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/orders/${orderId}/assign`)
    .set('Authorization', staff).send({ deliveryPersonId: seed.darLella.couriers.karimId }).expect(200);
  const karim = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  const mine = (await request(app).get('/api/v1/delivery/assignments').set('Authorization', karim)).body.assignments[0];
  assert.equal(mine.destinationZone, 'Lac 3');
  const detail = await request(app).get(`/api/v1/delivery/assignments/${mine.assignmentId}`).set('Authorization', karim);
  assert.equal(detail.body.assignment.customer.destinationZone, 'Lac 3');
  assert.equal(detail.body.assignment.pickup.zone, 'Lac 3');
});
