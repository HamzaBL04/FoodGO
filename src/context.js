'use strict';

const defaultConfig = require('./config');
const { createRepositories } = require('./repositories');
const { systemClock } = require('./domain/clock');
const { createSandboxSmsAdapter } = require('./adapters/smsOtpAdapter');
const { createAuthComponent } = require('./components/auth');
const { createAdminComponent } = require('./components/admin');

/**
 * Composition root: wires repositories, adapters and business components.
 * Tests call this with an in-memory database, a fixed clock and quiet adapters.
 */
function createContext({ db, clock = systemClock(), adapters = {}, config = defaultConfig }) {
  const repos = createRepositories(db);
  const sms = adapters.sms || createSandboxSmsAdapter({ log: !config.isTest });

  const auth = createAuthComponent({ repos, clock, sms, config });
  const admin = createAdminComponent({ repos, clock, auth });

  return {
    config,
    clock,
    repos,
    adapters: { sms },
    components: { auth, admin },
  };
}

module.exports = { createContext };
