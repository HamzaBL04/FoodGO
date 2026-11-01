'use strict';

const defaultConfig = require('./config');
const { createRepositories } = require('./repositories');
const { systemClock } = require('./domain/clock');
const { createSandboxSmsAdapter } = require('./adapters/smsOtpAdapter');
const { createAuthComponent } = require('./components/auth');
const { createAdminComponent } = require('./components/admin');
const { createRestaurantManagement } = require('./components/restaurantManagement');
const { createCustomerComponent } = require('./components/customerComponent');
const { createSandboxPaymentAdapter } = require('./adapters/paymentAdapter');
const { createSandboxNotificationAdapter } = require('./adapters/notificationAdapter');
const { createPaymentComponent } = require('./components/paymentComponent');
const { createNotificationComponent } = require('./components/notificationComponent');
const { createOrderManagement } = require('./components/orderManagement');
const { createDeliveryManagement } = require('./components/deliveryManagement');

/**
 * Composition root: wires repositories, adapters and business components.
 * Tests call this with an in-memory database, a fixed clock and quiet adapters.
 */
function createContext({ db, clock = systemClock(), adapters = {}, config = defaultConfig }) {
  const repos = createRepositories(db);
  const sms = adapters.sms || createSandboxSmsAdapter({ log: !config.isTest });
  const paymentAdapter = adapters.payment || createSandboxPaymentAdapter();
  const notificationAdapter = adapters.notification || createSandboxNotificationAdapter({ log: !config.isTest });
  const logger = config.isTest ? { error: () => {} } : console;

  const auth = createAuthComponent({ repos, clock, sms, config });
  const admin = createAdminComponent({ repos, clock, auth });
  const restaurantManagement = createRestaurantManagement({ repos, clock, auth, sms });
  const customer = createCustomerComponent({ repos, clock });
  const notifications = createNotificationComponent({ notificationAdapter, logger });
  const payments = createPaymentComponent({ repos, clock, paymentAdapter });
  const orders = createOrderManagement({ repos, clock, customer, payments, notifications });
  const delivery = createDeliveryManagement({ repos, clock, orders, payments, notifications });

  return {
    config,
    clock,
    repos,
    adapters: { sms, payment: paymentAdapter, notification: notificationAdapter },
    components: { auth, admin, restaurantManagement, customer, notifications, payments, orders, delivery },
  };
}

module.exports = { createContext };
