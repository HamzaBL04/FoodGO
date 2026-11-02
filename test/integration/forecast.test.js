'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const url = (seed) => `/api/v1/restaurants/${seed.darLella.restaurantId}/forecast`;

test('FR-31: staff get a forecast built from order history, with a template summary by default', async () => {
  const { app, seed } = createTestApp({ historyDays: 28 });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const res = await request(app).get(url(seed)).set('Authorization', staff);
  assert.equal(res.status, 200);
  const f = res.body.forecast;
  assert.equal(f.serviceDate, '2026-11-02'); // 08:00 Monday, Dar Lella still open
  assert.equal(f.weekday, 'Monday');
  assert.equal(f.dishes.length, 8);
  assert.ok(f.totals.expected > 10, `expected a meaningful total, got ${f.totals.expected}`);
  assert.ok(f.dishes.every((d) => d.low <= d.expected && d.expected <= d.high));
  assert.ok(f.accuracy && f.accuracy.days.length === 7);
  assert.equal(f.summarySource, 'template');
  assert.match(f.summary, /Expect around \d+ dishes on Monday/);
  assert.match(f.advisory, /restaurant decides/);
});

test('forecast counts orders already placed for the target day', async () => {
  const { app, seed } = createTestApp({ historyDays: 28 });
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  await request(app).post('/api/v1/customer/orders').set('Authorization', customer).send({
    restaurantId: seed.darLella.restaurantId,
    items: [{ menuItemId: seed.darLella.items[0].menuItemId, quantity: 3 }],
    paymentMethod: 'CASH_ON_DELIVERY',
  }).expect(201);
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.dishes.find((d) => d.name === 'Couscous au poulet').alreadyOrdered, 3);
  assert.equal(f.totals.alreadyOrdered, 3);
});

test('after the deadline the forecast targets tomorrow', async () => {
  const { app, seed } = createTestApp({ historyDays: 28, at: '2026-11-02T23:45:00+01:00' });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.serviceDate, '2026-11-03');
});

test('with an LLM configured the summary comes from it, and only aggregate data is sent', async () => {
  let prompt = '';
  const llm = { enabled: true, model: 'claude-test', complete: async (p) => { prompt = p; return 'Prepare extra couscous.'; } };
  const { app, seed } = createTestApp({ historyDays: 28, adapters: { llm } });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.summary, 'Prepare extra couscous.');
  assert.equal(f.summarySource, 'claude (claude-test)');
  assert.match(prompt, /Couscous au poulet: expected \d+/);
  assert.doesNotMatch(prompt, /\+216|Yasmine|Omar|Trabelsi/, 'no customer personal data in the prompt');
});

test('if the LLM fails, the template summary is used and nothing breaks', async () => {
  const llm = { enabled: true, model: 'x', complete: async () => { throw new Error('timeout'); } };
  const { app, seed } = createTestApp({ historyDays: 28, adapters: { llm } });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.summarySource, 'template');
});

test('no history: the forecast says so instead of inventing numbers', async () => {
  const { app, seed } = createTestApp({ historyDays: 0 });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.totals.expected, 0);
  assert.equal(f.accuracy, null);
  assert.match(f.summary, /no order history yet/);
});

test('the forecast is restaurant-scoped and staff-only', async () => {
  const { app, seed } = createTestApp({ historyDays: 7 });
  const kramSnack = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.kramSnackStaff);
  assert.equal((await request(app).get(url(seed)).set('Authorization', kramSnack)).status, 403);
  const customer = await signInCustomer(request, app, DEMO_ACCOUNTS.omar.phone);
  assert.equal((await request(app).get(url(seed)).set('Authorization', customer)).status, 403);
});

test('viewing a forecast is audited with its summary source', async () => {
  const { app, seed, ctx } = createTestApp({ historyDays: 7 });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  await request(app).get(url(seed)).set('Authorization', staff).expect(200);
  const evt = ctx.repos.platform.recentAudit(5).find((e) => e.action === 'FORECAST_VIEWED');
  assert.ok(evt);
  assert.match(evt.detail, /template/);
});

test('weekdays without any recent orders are skipped (restaurant usually closed)', async () => {
  // Sunday morning: the seeded history has no Sunday service
  const { app, seed } = createTestApp({ historyDays: 28, at: '2026-11-01T08:00:00+01:00' });
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const f = (await request(app).get(url(seed)).set('Authorization', staff)).body.forecast;
  assert.equal(f.serviceDate, '2026-11-02');
  assert.equal(f.weekday, 'Monday');
  assert.match(f.note, /No orders on Sundays/);
});
