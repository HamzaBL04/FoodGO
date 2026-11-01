'use strict';

const config = require('./config');
const { openDatabase } = require('./db/connection');
const { createContext } = require('./context');
const { createApp } = require('./app');
const { seedDemoData, DEMO_ACCOUNTS } = require('./db/seedData');

function start() {
  const db = openDatabase(config.dbFile);
  const ctx = createContext({ db });

  // First run: create the demo dataset so the app works straight after
  // `npm install && npm start`. `npm run seed` resets it at any time.
  if (ctx.repos.restaurants.listAll().length === 0) {
    seedDemoData(ctx.repos, { clock: ctx.clock, historyDays: 28 });
    console.log('First run: demo data created. Demo accounts:');
    console.log(JSON.stringify(DEMO_ACCOUNTS, null, 2));
  }

  const app = createApp(ctx);
  const server = app.listen(config.port, () => {
    console.log(`FoodGO running at http://localhost:${config.port}  (API docs: /api/docs)`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (require.main === module) start();

module.exports = { start };
