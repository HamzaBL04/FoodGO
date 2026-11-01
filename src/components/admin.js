'use strict';

const { AppError } = require('../domain/errors');
const { newId } = require('../domain/ids');
const { isValidDeadline, localDateString } = require('../domain/deadline');
const { zoneLabel } = require('../domain/serviceArea');

/**
 * Platform administration (UN-24, FR-29, SDD §5.1.5). Platform scope, not
 * restaurant scope. Read-only on operational data: the administrator manages
 * accounts and restaurants, never orders.
 */
function createAdminComponent({ repos, clock, auth }) {
  function listRestaurants() {
    return repos.restaurants.listAll().map((r) => ({ ...r, zone: zoneLabel(r.serviceZone) }));
  }

  /** FR-32 / BR-17: every restaurant is located in a service zone (the schema validates the list). */
  function createRestaurant(admin, { name, orderingDeadline, address, serviceZone }) {
    if (!isValidDeadline(orderingDeadline)) throw new AppError('VAL-001', 'orderingDeadline must be HH:MM');
    const restaurantId = newId('rst');
    repos.unitOfWork(() => {
      repos.restaurants.insert({
        restaurantId,
        name,
        orderingDeadline,
        cashOnDeliveryEnabled: 1,
        ePaymentEnabled: 1,
        address: address || null,
        serviceZone,
      });
      // SDD §3.3: an operating restaurant has at least one menu.
      repos.restaurants.insertMenu(newId('menu'), restaurantId);
      repos.platform.audit({
        at: clock.now().toISOString(), actorRole: 'ADMIN', actorId: admin.subjectId, restaurantId,
        action: 'RESTAURANT_CREATED', entity: 'restaurant', entityId: restaurantId,
      });
    });
    return repos.restaurants.findById(restaurantId);
  }

  function listStaff() {
    return repos.accounts.listAllStaff();
  }

  function provisionStaff(admin, input) {
    return auth.provisionStaff(admin, input);
  }

  /** Operational monitoring (BG-09): counts, today's orders by status, audit trail. */
  function monitor() {
    const serviceDate = localDateString(clock.now());
    const byRestaurant = new Map();
    for (const row of repos.platform.ordersByStatus(serviceDate)) {
      const entry = byRestaurant.get(row.restaurantId) || { restaurantId: row.restaurantId, name: row.name, today: {} };
      if (row.status) entry.today[row.status] = row.n;
      byRestaurant.set(row.restaurantId, entry);
    }
    return {
      serviceDate,
      totals: repos.platform.counts(),
      restaurants: [...byRestaurant.values()],
      recentEvents: repos.platform.recentAudit(30),
    };
  }

  return { listRestaurants, createRestaurant, listStaff, provisionStaff, monitor };
}

module.exports = { createAdminComponent };
