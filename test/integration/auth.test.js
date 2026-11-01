'use strict';

const { createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

test('staff signs in with password and gets a restaurant-bound session', async () => {
  const { app, seed } = createTestApp();
  const res = await request(app).post('/api/v1/auth/signin').send({ role: 'STAFF', ...DEMO_ACCOUNTS.darLellaStaff });
  assert.equal(res.status, 200);
  assert.equal(res.body.session.role, 'STAFF');
  assert.equal(res.body.session.restaurantId, seed.darLella.restaurantId);
  assert.match(res.headers['set-cookie'][0], /fg_session=.*HttpOnly/);
  assert.equal(res.body.session.credentialHash, undefined, 'never expose the hash');
});

test('AUTH-001: wrong password and unknown identity get the same answer', async () => {
  const { app } = createTestApp();
  const wrong = await request(app).post('/api/v1/auth/signin').send({ role: 'STAFF', identity: 'staff@darlella.tn', password: 'nope' });
  const unknown = await request(app).post('/api/v1/auth/signin').send({ role: 'STAFF', identity: 'ghost@x.tn', password: 'nope' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
});

test('a staff identity cannot sign in under another role', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/v1/auth/signin').send({ role: 'ADMIN', ...DEMO_ACCOUNTS.darLellaStaff });
  assert.equal(res.status, 401);
});

test('VAL-001: invalid sign-in payload is rejected before the component', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/v1/auth/signin').send({ role: 'ROOT', identity: 'x', password: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VAL-001');
});

test('customer OTP flow: request, verify, session', async () => {
  const { app, ctx } = createTestApp();
  const auth = await signInCustomer(request, app, DEMO_ACCOUNTS.yasmine.phone);
  const session = await request(app).get('/api/v1/auth/session').set('Authorization', auth);
  assert.equal(session.status, 200);
  assert.equal(session.body.session.role, 'CUSTOMER');
  assert.equal(session.body.session.fullName, 'Yasmine Ben Ali');
  assert.equal(ctx.adapters.sms.outbox()[0].to, DEMO_ACCOUNTS.yasmine.phone);
});

test('OTP: an unregistered phone number cannot request a code (BR-16)', async () => {
  const { app } = createTestApp();
  const res = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber: '+21699999999' });
  assert.equal(res.status, 401);
});

test('OTP: wrong code fails, the code is single-use and attempts are limited', async () => {
  const { app } = createTestApp();
  const r1 = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber: DEMO_ACCOUNTS.omar.phone });
  const wrongCode = r1.body.demoCode === '000000' ? '111111' : '000000';
  const bad = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r1.body.challengeId, code: wrongCode });
  assert.equal(bad.status, 401);
  const good = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r1.body.challengeId, code: r1.body.demoCode });
  assert.equal(good.status, 200);
  const replay = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r1.body.challengeId, code: r1.body.demoCode });
  assert.equal(replay.status, 401);

  const r2 = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber: DEMO_ACCOUNTS.omar.phone });
  for (let i = 0; i < 5; i += 1) {
    await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r2.body.challengeId, code: wrongCode });
  }
  const locked = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r2.body.challengeId, code: r2.body.demoCode });
  assert.equal(locked.status, 401);
});

test('OTP expires after the configured lifetime', async () => {
  const { app, clock } = createTestApp();
  const r1 = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber: DEMO_ACCOUNTS.omar.phone });
  clock.advanceMinutes(6);
  const res = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r1.body.challengeId, code: r1.body.demoCode });
  assert.equal(res.status, 401);
});

test('sign-out invalidates the session', async () => {
  const { app } = createTestApp();
  const auth = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  await request(app).post('/api/v1/auth/signout').set('Authorization', auth).expect(204);
  const res = await request(app).get('/api/v1/auth/session').set('Authorization', auth);
  assert.equal(res.status, 401);
});

test('sessions expire', async () => {
  const { app, clock } = createTestApp();
  const auth = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  clock.advanceMinutes(13 * 60);
  const res = await request(app).get('/api/v1/auth/session').set('Authorization', auth);
  assert.equal(res.status, 401);
});

test('admin routes: AUTH-001 anonymous, AUTH-002 for other roles', async () => {
  const { app } = createTestApp();
  const anon = await request(app).get('/api/v1/admin/restaurants');
  assert.equal(anon.status, 401);
  const staff = await signIn(request, app, 'STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const denied = await request(app).get('/api/v1/admin/restaurants').set('Authorization', staff);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'AUTH-002');
});

test('FR-29: admin creates a restaurant and provisions its staff, who can then sign in', async () => {
  const { app } = createTestApp();
  const admin = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  const r = await request(app).post('/api/v1/admin/restaurants').set('Authorization', admin)
    .send({ name: 'Sfax Grill', orderingDeadline: '10:00' });
  assert.equal(r.status, 201);
  const restaurantId = r.body.restaurant.restaurantId;

  const s = await request(app).post('/api/v1/admin/staff').set('Authorization', admin)
    .send({ restaurantId, identity: 'staff@sfaxgrill.tn', fullName: 'Rim Kammoun', password: 'Sfax#2026!' });
  assert.equal(s.status, 201);
  assert.equal(s.body.staff.credentialHash, undefined);

  const dup = await request(app).post('/api/v1/admin/staff').set('Authorization', admin)
    .send({ restaurantId, identity: 'staff@sfaxgrill.tn', fullName: 'Again', password: 'Sfax#2026!' });
  assert.equal(dup.status, 400);

  const login = await request(app).post('/api/v1/auth/signin').send({ role: 'STAFF', identity: 'staff@sfaxgrill.tn', password: 'Sfax#2026!' });
  assert.equal(login.status, 200);
  assert.equal(login.body.session.restaurantId, restaurantId);

  const bad = await request(app).post('/api/v1/admin/restaurants').set('Authorization', admin).send({ name: 'X', orderingDeadline: '25:00' });
  assert.equal(bad.status, 400);
});

test('admin monitor reports totals and the audit trail', async () => {
  const { app } = createTestApp();
  const admin = await signIn(request, app, 'ADMIN', DEMO_ACCOUNTS.admin);
  const res = await request(app).get('/api/v1/admin/monitor').set('Authorization', admin);
  assert.equal(res.status, 200);
  assert.equal(res.body.totals.restaurants, 2);
  assert.ok(res.body.recentEvents.some((e) => e.action === 'SIGNED_IN'));
  const staffList = await request(app).get('/api/v1/admin/staff').set('Authorization', admin);
  assert.equal(staffList.body.staff.length, 2);
});

test('health endpoint, unknown routes and malformed JSON', async () => {
  const { app } = createTestApp();
  await request(app).get('/health').expect(200);
  const missing = await request(app).get('/api/v1/nope');
  assert.equal(missing.status, 404);
  const bad = await request(app).post('/api/v1/auth/signin').set('Content-Type', 'application/json').send('{bad');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'VAL-001');
});
