'use strict';

const { createAccountRepository } = require('./accountRepository');
const { createCustomerRepository } = require('./customerRepository');
const { createRestaurantRepository } = require('./restaurantRepository');
const { createOrderRepository } = require('./orderRepository');
const { createPlatformRepository } = require('./platformRepository');

/**
 * Data Access layer (SDD §2.2). Only this layer issues SQL.
 * `unitOfWork(fn)` runs fn inside one SQLite transaction (T1–T3, SDD §4.4).
 */
function createRepositories(db) {
  return {
    accounts: createAccountRepository(db),
    customers: createCustomerRepository(db),
    restaurants: createRestaurantRepository(db),
    orders: createOrderRepository(db),
    platform: createPlatformRepository(db),
    unitOfWork: (fn) => db.transaction(fn)(),
  };
}

module.exports = { createRepositories };
