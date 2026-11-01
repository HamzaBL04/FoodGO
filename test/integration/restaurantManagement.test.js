'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

async function staffOf(app) {
  return signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
}

test('BR-09: staff cannot reach another restaurant through the URL', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const res = await request(app).get(`/api/v1/restaurants/${seed.campus.restaurantId}/menu`).set('Authorization', auth);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'AUTH-002');
});

test('customers and delivery people cannot use staff routes', async () => {
  const { app, seed } = createTestApp();
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const delivery = await signIn(request, app, 'DELIVERY', DEMO_ACCOUNTS.karim);
  for (const auth of [customer, delivery]) {
    const res = await request(app).get(`/api/v1/restaurants/${seed.darLella.restaurantId}/customers`).set('Authorization', auth);
    assert.equal(res.status, 403);
  }
});

test('FR-07: staff add, edit and soft-remove menu items', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const base = `/api/v1/restaurants/${seed.darLella.restaurantId}/menu`;

  const created = await request(app).post(`${base}/items`).set('Authorization', auth)
    .send({ name: 'Chorba frik', description: 'Lamb and freekeh soup', price: 7.25 });
  assert.equal(created.status, 201);
  assert.equal(created.body.item.priceMillimes, 7250);
  const id = created.body.item.menuItemId;

  const edited = await request(app).patch(`${base}/items/${id}`).set('Authorization', auth).send({ price: 7.5, name: 'Chorba frik maison' });
  assert.equal(edited.body.item.price, 7.5);
  assert.equal(edited.body.item.name, 'Chorba frik maison');

  await request(app).delete(`${base}/items/${id}`).set('Authorization', auth).expect(204);
  const menu = await request(app).get(base).set('Authorization', auth);
  assert.equal(menu.body.items.some((i) => i.menuItemId === id), false);
  const again = await request(app).patch(`${base}/items/${id}`).set('Authorization', auth).send({ price: 1 });
  assert.equal(again.status, 404);

  const invalid = await request(app).post(`${base}/items`).set('Authorization', auth).send({ name: 'X', price: -1 });
  assert.equal(invalid.status, 400);
});

test('FR-08: availability toggle is visible to the customer', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const item = seed.darLella.items[0];
  const res = await request(app).patch(`/api/v1/restaurants/${seed.darLella.restaurantId}/menu/items/${item.menuItemId}`)
    .set('Authorization', auth).send({ available: false });
  assert.equal(res.body.item.available, false);

  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const menu = await request(app).get(`/api/v1/customer/restaurants/${seed.darLella.restaurantId}/menu`).set('Authorization', customer);
  const seen = menu.body.items.find((i) => i.menuItemId === item.menuItemId);
  assert.equal(seen.available, false, 'unavailable items are shown, not hidden (SDD §5.1.2)');
});

test('settings: deadline and payment methods; at least one method must stay enabled', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const url = `/api/v1/restaurants/${seed.darLella.restaurantId}/settings`;
  const ok = await request(app).put(url).set('Authorization', auth)
    .send({ orderingDeadline: '10:15', cashOnDeliveryEnabled: false, ePaymentEnabled: true });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.settings.paymentMethods, ['E_PAYMENT']);
  const none = await request(app).put(url).set('Authorization', auth)
    .send({ orderingDeadline: '10:15', cashOnDeliveryEnabled: false, ePaymentEnabled: false });
  assert.equal(none.status, 400);
  const badTime = await request(app).put(url).set('Authorization', auth)
    .send({ orderingDeadline: '7am', cashOnDeliveryEnabled: true, ePaymentEnabled: true });
  assert.equal(badTime.status, 400);
});

test('UC-04: in-person registration creates a person and a membership, then OTP sign-in works', async () => {
  const { app, seed, ctx } = createTestApp();
  const auth = await staffOf(app);
  const url = `/api/v1/restaurants/${seed.darLella.restaurantId}/customers`;
  const res = await request(app).post(url).set('Authorization', auth).send({
    fullName: 'Lina Ghannouchi', phoneNumber: '+21627000111', organizationId: seed.orgs.lac2.organizationId, identityVerified: true,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.customer.existingPerson, false);
  assert.equal(res.body.customer.credentialRef, undefined);
  assert.match(ctx.adapters.sms.outbox()[0].message, /Dar Lella registered you/);

  const customer = await signInCustomer(request, app, '+21627000111');
  const list = await request(app).get('/api/v1/customer/restaurants').set('Authorization', customer);
  assert.deepEqual(list.body.restaurants.map((r) => r.name), ['Dar Lella']);

  const dup = await request(app).post(url).set('Authorization', auth).send({
    fullName: 'Lina Ghannouchi', phoneNumber: '+21627000111', organizationId: seed.orgs.lac2.organizationId, identityVerified: true,
  });
  assert.equal(dup.status, 400);
});

test('BR-05: registration requires in-person identity verification', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const res = await request(app).post(`/api/v1/restaurants/${seed.darLella.restaurantId}/customers`).set('Authorization', auth).send({
    fullName: 'No Check', phoneNumber: '+21627000999', organizationId: seed.orgs.lac2.organizationId,
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /BR-05/);
});

test('D-01: a person registered at two restaurants is stored once, with two memberships', async () => {
  const { app, seed, ctx } = createTestApp();
  const campus = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.campusStaff);
  const res = await request(app).post(`/api/v1/restaurants/${seed.campus.restaurantId}/customers`).set('Authorization', campus).send({
    fullName: 'Omar Trabelsi', phoneNumber: DEMO_ACCOUNTS.omar.phone, organizationId: seed.orgs.lac2.organizationId, identityVerified: true,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.customer.existingPerson, true);
  assert.equal(res.body.customer.customerId, seed.customers.omar.customerId);
  assert.equal(ctx.repos.platform.counts().customers, 3);
});

test('BR-15 / FR-16: staff see verification info only for their own customers', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const base = `/api/v1/restaurants/${seed.darLella.restaurantId}/customers`;
  const own = await request(app).get(`${base}/${seed.customers.omar.customerId}`).set('Authorization', auth);
  assert.equal(own.status, 200);
  assert.equal(own.body.customer.organizationName, 'Lac 2 Tech Park');
  // Nour is registered only at Campus Bites
  const other = await request(app).get(`${base}/${seed.customers.nour.customerId}`).set('Authorization', auth);
  assert.equal(other.status, 404);
  const list = await request(app).get(base).set('Authorization', auth);
  assert.equal(list.body.customers.some((c) => c.customerId === seed.customers.nour.customerId), false);
});

test('FR-17: making a customer ineligible removes the restaurant from their list', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const res = await request(app).patch(`/api/v1/restaurants/${seed.darLella.restaurantId}/customers/${seed.customers.omar.customerId}`)
    .set('Authorization', auth).send({ eligible: false });
  assert.equal(res.body.customer.eligible, false);
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  assert.equal((await request(app).get('/api/v1/customer/restaurants').set('Authorization', customer)).body.restaurants.length, 2);
  const menu = await request(app).get(`/api/v1/customer/restaurants/${seed.campus.restaurantId}/menu`).set('Authorization', customer);
  assert.equal(menu.status, 200);
  // Omar can no longer sign in: he has no eligible membership left
  const otp = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber: DEMO_ACCOUNTS.omar.phone });
  assert.equal(otp.status, 401);
});

test('BR-04: a customer cannot read the menu of a restaurant that did not register them', async () => {
  const { app, seed } = createTestApp();
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  const res = await request(app).get(`/api/v1/customer/restaurants/${seed.campus.restaurantId}/menu`).set('Authorization', customer);
  assert.equal(res.status, 403);
});

test('FR-18 / FR-30: staff provision their own delivery personnel', async () => {
  const { app, seed } = createTestApp();
  const auth = await staffOf(app);
  const url = `/api/v1/restaurants/${seed.darLella.restaurantId}/delivery-personnel`;
  const res = await request(app).post(url).set('Authorization', auth)
    .send({ identity: 'hatem.r', fullName: 'Hatem Rebai', password: 'Delivery#2026', phoneNumber: '+21650999000' });
  assert.equal(res.status, 201);
  assert.equal(res.body.deliveryPerson.credentialHash, undefined);
  const list = await request(app).get(url).set('Authorization', auth);
  assert.equal(list.body.deliveryPersonnel.length, 3);
  const login = await request(app).post('/api/v1/auth/signin').send({ role: 'DELIVERY', identity: 'hatem.r', password: 'Delivery#2026' });
  assert.equal(login.status, 200);
});

test('organizations: list and create, duplicates refused', async () => {
  const { app } = createTestApp();
  const auth = await staffOf(app);
  const list = await request(app).get('/api/v1/organizations').set('Authorization', auth);
  assert.equal(list.body.organizations.length, 3);
  const created = await request(app).post('/api/v1/organizations').set('Authorization', auth).send({ name: 'ESPRIT Ghazela', type: 'CAMPUS' });
  assert.equal(created.status, 201);
  const dup = await request(app).post('/api/v1/organizations').set('Authorization', auth).send({ name: 'esprit ghazela', type: 'CAMPUS' });
  assert.equal(dup.status, 400);
});

test('customer profile and restaurant list carry deadline information', async () => {
  const { app } = createTestApp();
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const me = await request(app).get('/api/v1/customer/me').set('Authorization', customer);
  assert.equal(me.body.profile.organization.name, 'MUST University');
  const list = await request(app).get('/api/v1/customer/restaurants').set('Authorization', customer);
  const campus = list.body.restaurants.find((r) => r.name === 'Campus Bites');
  assert.equal(campus.orderingOpen, true); // 08:00 < 10:30
  assert.equal(campus.minutesLeft, 150);
});
