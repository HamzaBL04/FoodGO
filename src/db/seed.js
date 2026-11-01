'use strict';

/**
 * CLI: `npm run seed` (re)creates the demo database at data/foodgo.db.
 * All existing data in that file is deleted first.
 */
const fs = require('node:fs');
const config = require('../config');
const { openDatabase } = require('./connection');
const { createRepositories } = require('../repositories');
const { systemClock } = require('../domain/clock');
const { seedDemoData, DEMO_ACCOUNTS } = require('./seedData');

function reset(file) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
}

function main() {
  reset(config.dbFile);
  const db = openDatabase(config.dbFile);
  const repos = createRepositories(db);
  seedDemoData(repos, { clock: systemClock(), historyDays: 28 });
  const { counts } = repos.platform;
  console.log('FoodGO demo database created at', config.dbFile);
  console.log(counts());
  console.log('Demo accounts:', JSON.stringify(DEMO_ACCOUNTS, null, 2));
  db.close();
}

if (require.main === module) main();

module.exports = { main };
