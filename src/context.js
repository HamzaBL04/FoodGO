'use strict';

const defaultConfig = require('./config');
const { createRepositories } = require('./repositories');
const { systemClock } = require('./domain/clock');
const { createSandboxSmsAdapter } = require('./adapters/smsOtpAdapter');
const { createAuthComponent } = require('./components/auth');
const { createAdminComponent } = require('./components/admin');
const { createRestaurantManagement } = require('./components/restaurantManagement');
const { createCustomerComponent } = require('./components/customerComponent');

/**
 * Composition root: wires repositories, adapters and business components.
 * Tests call this with an in-memory database, a fixed clock and quiet adapters.
 */
function createContext({ db, clock = systemClock(), adapters = {}, config = defaultConfig }) {
  const repos = createRepositories(db);
  const sms = adapters.sms || createSandboxSmsAdapter({ log: !config.isTest });

  const auth = createAuthComponent({ repos, clock, sms, config });
  const admin = createAdminComponent({ repos, clock, auth });
  const restaurantManagement = createRestaurantManagement({ repos, clock, auth, sms });
  const customer = createCustomerComponent({ repos, clock });

  return {
    config,
    clock,
    repos,
    adapters: { sms },
    components: { auth, admin, restaurantManagement, customer },
  };
}

module.exports = { createContext };
