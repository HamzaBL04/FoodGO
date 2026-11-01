'use strict';

/**
 * API latency benchmark for the refactor & optimisation report (NFR-01).
 *
 * Builds an in-memory database shaped like a busy restaurant: 120 days of
 * history (~2 000 orders) plus a lunch peak of 300 orders today, starts the
 * app on a random port and measures p50/p95/p99 latency of the hot endpoints.
 *
 * Usage: node scripts/benchmark.js [iterations=200]
 */
process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Tunis';

const { performance } = require('node:perf_hooks');
const { openDatabase } = require('../src/db/connection');
const { createContext } = require('../src/context');
const { createApp } = require('../src/app');
const { fixedClock } = require('../src/domain/clock');
const { seedDemoData, DEMO_ACCOUNTS } = require('../src/db/seedData');

const ITER = Number(process.argv[2]) || 200;

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const db = openDatabase(':memory:');
  const clock = fixedClock('2026-11-02T08:00:00+01:00');
  const ctx = createContext({ db, clock });
  const seed = seedDemoData(ctx.repos, { clock, historyDays: 120 });

  // Lunch peak: 300 orders today at Dar Lella from the registered customers.
  const members = ctx.repos.customers.listMembers(seed.darLella.restaurantId);
  const items = seed.darLella.items;
  for (let i = 0; i < 300; i += 1) {
    const customer = members[i % members.length];
    ctx.components.orders.submitOrder(
      { role: 'CUSTOMER', subjectId: customer.customerId },
      {
        restaurantId: seed.darLella.restaurantId,
        items: [{ menuItemId: items[i % items.length].menuItemId, quantity: 1 + (i % 3) }, { menuItemId: items[(i + 3) % items.length].menuItemId, quantity: 1 }],
        paymentMethod: 'CASH_ON_DELIVERY',
      },
    );
  }

  const app = createApp(ctx, { logger: { error: () => {} } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const post = (p, body, auth) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });
  const signIn = async (role, a) => `Bearer ${(await (await post('/auth/signin', { role, identity: a.identity, password: a.password })).json()).token}`;

  const staff = await signIn('STAFF', DEMO_ACCOUNTS.darLellaStaff);
  const karim = await signIn('DELIVERY', DEMO_ACCOUNTS.karim);
  const otp = await (await post('/auth/otp/request', { phoneNumber: DEMO_ACCOUNTS.yasmine.phone })).json();
  const yasmine = `Bearer ${(await (await post('/auth/otp/verify', { challengeId: otp.challengeId, code: otp.demoCode })).json()).token}`;
  const rid = seed.darLella.restaurantId;

  const scenarios = [
    ['GET restaurant order board (300 orders today)', () => fetch(`${base}/restaurants/${rid}/orders`, { headers: { authorization: staff } })],
    ['GET customer order history', () => fetch(`${base}/customer/orders`, { headers: { authorization: yasmine } })],
    ['GET delivery assignments (courier with history)', () => fetch(`${base}/delivery/assignments`, { headers: { authorization: karim } })],
    ['GET prep forecast', () => fetch(`${base}/restaurants/${rid}/forecast`, { headers: { authorization: staff } })],
    ['POST submit order (transaction T1)', () => post('/customer/orders', { restaurantId: rid, items: [{ menuItemId: items[2].menuItemId, quantity: 1 }], paymentMethod: 'CASH_ON_DELIVERY' }, yasmine)],
  ];

  const results = [];
  for (const [name, call] of scenarios) {
    for (let w = 0; w < 10; w += 1) await (await call()).arrayBuffer(); // warm-up
    const times = [];
    for (let i = 0; i < ITER; i += 1) {
      const t0 = performance.now();
      const res = await call();
      await res.arrayBuffer();
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const r = (v) => Number(v.toFixed(2));
    results.push({ endpoint: name, p50: r(percentile(times, 50)), p95: r(percentile(times, 95)), p99: r(percentile(times, 99)), mean: r(times.reduce((a, b) => a + b, 0) / times.length) });
  }
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    node: process.version,
    iterations: ITER,
    dataset: ctx.repos.platform.counts(),
    results,
    memory: { rssMB: Number((mem.rss / 1048576).toFixed(1)), heapUsedMB: Number((mem.heapUsed / 1048576).toFixed(1)) },
  }, null, 2));
  server.close();
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
