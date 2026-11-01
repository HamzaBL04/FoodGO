'use strict';

process.env.NODE_ENV = 'test';
process.env.TZ = 'Africa/Tunis';

const { openDatabase } = require('../src/db/connection');
const { createRepositories } = require('../src/repositories');
const { fixedClock } = require('../src/domain/clock');
const { seedDemoData } = require('../src/db/seedData');

/** 08:00 Tunis time on a Monday — before Campus Bites' 10:30 deadline. */
const MONDAY_8AM = '2026-11-02T08:00:00+01:00';

function createTestData({ at = MONDAY_8AM, historyDays = 0 } = {}) {
  const db = openDatabase(':memory:');
  const repos = createRepositories(db);
  const clock = fixedClock(at);
  const seed = seedDemoData(repos, { clock, historyDays });
  return { db, repos, clock, seed };
}

module.exports = { createTestData, MONDAY_8AM };
