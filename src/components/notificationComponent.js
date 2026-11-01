'use strict';

const { EventEmitter } = require('node:events');
const { labelOf } = require('../domain/orderState');

/** Event catalogue, SDD §6.2. */
const EVENTS = Object.freeze({
  ORDER_SUBMITTED: 'OrderSubmitted', // E-01
  ORDER_CONFIRMED: 'OrderConfirmed', // E-02
  DELIVERY_ASSIGNED: 'DeliveryAssigned', // E-03
  DELIVERY_STATUS_CHANGED: 'DeliveryStatusChanged', // E-04
  PAYMENT_STATUS_CHANGED: 'PaymentStatusChanged', // E-05
  ORDER_STATUS_CHANGED: 'OrderStatusChanged',
});

/**
 * Observer pattern (SDD §7.1.3). Components publish events AFTER their
 * transaction commits (D-08); listeners decide who may receive them (BR-15).
 * A listener that throws is logged and never affects the committed order.
 */
function createNotificationComponent({ notificationAdapter, logger = console }) {
  const bus = new EventEmitter();
  bus.setMaxListeners(200);

  function publish(type, payload) {
    const event = { type, at: new Date().toISOString(), ...payload };
    for (const listener of bus.listeners('event')) {
      try {
        listener(event);
      } catch (err) {
        logger.error(`[events] listener failed for ${type}`, err);
      }
    }
  }

  function subscribe(listener) {
    bus.on('event', listener);
    return () => bus.off('event', listener);
  }

  // Outbound notification channel. Recipients are derived from the event,
  // never chosen by a caller, so a customer can only be told about their own order.
  subscribe((e) => {
    const forCustomer = (msg) => notificationAdapter.notify({ role: 'CUSTOMER', id: e.customerId }, msg);
    if (e.type === EVENTS.ORDER_CONFIRMED) forCustomer(`Order ${e.orderId} confirmed. Total ${e.total} TND.`);
    if (e.type === EVENTS.ORDER_SUBMITTED) {
      notificationAdapter.notify({ role: 'RESTAURANT', id: e.restaurantId }, `New pre-order ${e.orderId}`);
    }
    if (e.type === EVENTS.DELIVERY_ASSIGNED) {
      notificationAdapter.notify({ role: 'DELIVERY', id: e.deliveryPersonId }, `Order ${e.orderId} assigned to you`);
    }
    if (e.type === EVENTS.ORDER_STATUS_CHANGED) forCustomer(`Order ${e.orderId}: ${labelOf(e.status)}`);
  });

  return { EVENTS, publish, subscribe, visibleTo };
}

/**
 * BR-15 for the live stream: which principal may see which event.
 * Customers see their own orders, staff their own restaurant, delivery
 * people their own assignments; administrators get no order events.
 */
function visibleTo(principal, event) {
  if (!principal) return false;
  if (principal.role === 'CUSTOMER') return event.customerId === principal.subjectId;
  if (principal.role === 'STAFF') return event.restaurantId === principal.restaurantId;
  if (principal.role === 'DELIVERY') return Boolean(event.deliveryPersonId) && event.deliveryPersonId === principal.subjectId;
  return false;
}

module.exports = { createNotificationComponent, EVENTS, visibleTo };
