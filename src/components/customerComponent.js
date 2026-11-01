'use strict';

const { AppError } = require('../domain/errors');
const { evaluateDeadline } = require('../domain/deadline');
const { menuItemView, paymentMethodsFor } = require('./presenters');

/**
 * Customer Component (SDD §2.3): the customer's own record, the restaurants
 * that registered them, and those restaurants' menus. A customer only ever
 * sees restaurants that registered them (BR-04, BR-16).
 */
function createCustomerComponent({ repos, clock }) {
  function deadlineInfo(restaurant) {
    const gate = evaluateDeadline(clock.now(), restaurant.orderingDeadline);
    return {
      orderingDeadline: restaurant.orderingDeadline,
      orderingOpen: gate.open,
      minutesLeft: gate.open ? gate.minutesLeft : 0,
      serviceDate: gate.serviceDate,
    };
  }

  /** UC-05 / FR-05. */
  function listMyRestaurants(customerId) {
    return repos.restaurants.listForCustomer(customerId).map((r) => ({
      restaurantId: r.restaurantId,
      name: r.name,
      address: r.address,
      paymentMethods: paymentMethodsFor(r),
      ...deadlineInfo(r),
    }));
  }

  /** Throws AUTH-002 unless the customer holds an active, eligible membership. */
  function assertMembership(customerId, restaurantId) {
    const m = repos.customers.findMembership(restaurantId, customerId);
    if (!m || m.status !== 'ACTIVE' || m.eligible !== 1) {
      throw new AppError('AUTH-002', 'You are not registered with this restaurant');
    }
    return m;
  }

  /** UC-06 / FR-06, FR-08, FR-09 (selection happens on this menu): unavailable items are shown but not orderable. */
  function getMenu(customerId, restaurantId) {
    assertMembership(customerId, restaurantId);
    const r = repos.restaurants.findById(restaurantId);
    return {
      restaurant: { restaurantId: r.restaurantId, name: r.name, address: r.address, paymentMethods: paymentMethodsFor(r), ...deadlineInfo(r) },
      items: repos.restaurants.listItems(restaurantId).map(menuItemView),
    };
  }

  function getProfile(customerId) {
    const c = repos.customers.findCustomer(customerId);
    return {
      customerId: c.customerId,
      fullName: c.fullName,
      phoneNumber: c.phoneNumber,
      organization: { organizationId: c.organizationId, name: c.organizationName, type: c.organizationType },
    };
  }

  return { listMyRestaurants, getMenu, getProfile, assertMembership };
}

module.exports = { createCustomerComponent };
