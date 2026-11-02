'use strict';

process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Tunis';

const { openDatabase } = require('../src/db/connection');
const { createRepositories } = require('../src/repositories');
const { fixedClock } = require('../src/domain/clock');
const { seedDemoData } = require('../src/db/seedData');

/** 08:00 Tunis time on a Monday — before Kram Snack's 10:30 deadline. */
const MONDAY_8AM = '2026-11-02T08:00:00+01:00';

function createTestData({ at = MONDAY_8AM, historyDays = 0 } = {}) {
  const db = openDatabase(':memory:');
  const repos = createRepositories(db);
  const clock = fixedClock(at);
  const seed = seedDemoData(repos, { clock, historyDays });
  return { db, repos, clock, seed };
}

const quietLogger = { error: () => {}, log: () => {}, warn: () => {} };

/** Full application over an in-memory database with a fixed clock. */
function createTestApp({ at = MONDAY_8AM, historyDays = 0, adapters = {} } = {}) {
  const { createContext } = require('../src/context');
  const { createApp } = require('../src/app');
  const config = require('../src/config');
  const db = openDatabase(':memory:');
  const clock = fixedClock(at);
  const ctx = createContext({ db, clock, adapters, config });
  const seed = seedDemoData(ctx.repos, { clock, historyDays });
  const app = createApp(ctx, { logger: quietLogger });
  return { app, ctx, seed, clock, db };
}

const { DEMO_ACCOUNTS } = require('../src/db/seedData');

/** Signs in with a password role and returns an Authorization header value. */
async function signIn(request, app, role, account) {
  const res = await request(app).post('/api/v1/auth/signin').send({ role, identity: account.identity, password: account.password });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return `Bearer ${res.body.token}`;
}

/** Customer OTP sign-in using the demo code returned in demo mode. */
async function signInCustomer(request, app, phoneNumber) {
  const r1 = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber });
  if (r1.status !== 201) throw new Error(`otp request failed: ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: r1.body.challengeId, code: r1.body.demoCode });
  if (r2.status !== 200) throw new Error(`otp verify failed: ${r2.status}`);
  return `Bearer ${r2.body.token}`;
}

module.exports = { createTestData, createTestApp, signIn, signInCustomer, DEMO_ACCOUNTS, MONDAY_8AM };
