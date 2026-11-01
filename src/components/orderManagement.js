'use strict';

const { AppError } = require('../domain/errors');
const { newId, newOrderId } = require('../domain/ids');
const { fromMillimes } = require('../domain/money');
const { evaluateDeadline, localDateString } = require('../domain/deadline');
const { assertInServiceArea, zoneLabel } = require('../domain/serviceArea');
const { ORDER_STATUS, transition, labelOf, allowedNext } = require('../domain/orderState');
const { EVENTS } = require('./notificationComponent');
const { createAuditor } = require('./audit');

/**
 * Order Management component (SDD §2.3). The only component permitted to
 * create an Order or change its status (constraint 5).
 */
function createOrderManagement({ repos, clock, customer, payments, notifications }) {
  const nowIso = () => clock.now().toISOString();
  const audit = createAuditor({ repos, clock });

  // ---- views -------------------------------------------------------------

  function deliveryView(assignment) {
    if (!assignment) return null;
    return {
      assignmentId: assignment.assignmentId,
      status: assignment.status,
      deliveryPersonName: assignment.deliveryPersonName,
      assignedAt: assignment.assignedAt,
      startedAt: assignment.startedAt,
      completedAt: assignment.completedAt,
    };
  }

  function orderView(order, { items, assignment } = {}) {
    const lines = (items || repos.orders.listItems(order.orderId)).map((i) => ({
      menuItemId: i.menuItemId,
      name: i.nameSnapshot,
      quantity: i.quantity,
      unitPrice: fromMillimes(i.unitPriceMillimes),
      lineTotal: fromMillimes(i.quantity * i.unitPriceMillimes), // derived, not stored (§4.3)
    }));
    return {
      orderId: order.orderId,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName,
      status: order.status,
      statusLabel: labelOf(order.status),
      total: fromMillimes(order.totalMillimes),
      totalMillimes: order.totalMillimes,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      serviceDate: order.serviceDate,
      deadlineSnapshot: order.deadlineSnapshot,
      items: lines,
      delivery: deliveryView(assignment === undefined ? repos.orders.findAssignmentForOrder(order.orderId) : assignment),
    };
  }

  // ---- submission: T1 (SDD §4.4, UC-01) ----------------------------------

  /** Merges repeated items and checks each against the restaurant's menu. */
  function buildLines(restaurantId, requestedItems) {
    const merged = new Map();
    for (const { menuItemId, quantity } of requestedItems) {
      merged.set(menuItemId, (merged.get(menuItemId) || 0) + quantity);
    }
    return [...merged.entries()].map(([menuItemId, quantity]) => {
      // FR-10: quantities per item are bounded.
      if (quantity > 50) throw new AppError('VAL-001', 'At most 50 of one item per order');
      // I-5: the item must belong to the same restaurant as the order.
      const item = repos.restaurants.findItem(restaurantId, menuItemId);
      if (!item || item.removed === 1) throw new AppError('VAL-001', 'An item is not on this restaurant\'s menu');
      // BR-02: availability is read inside the transaction, not cached.
      if (item.available !== 1) throw new AppError('ORDER-002', `${item.name} is currently unavailable`);
      return { item, quantity };
    });
  }

  /**
   * UC-01 / FR-09–FR-15: submit a morning pre-order.
   * Verify membership, read deadline, read availability, write order + items +
   * payment row + deadline snapshot — all or nothing (T1).
   */
  function submitOrder(principal, { restaurantId, items, paymentMethod }, { idempotencyKey } = {}) {
    const customerId = principal.subjectId;
    if (idempotencyKey) {
      const existing = repos.orders.findOrderIdByRequest(customerId, idempotencyKey);
      if (existing) return { order: getOwnOrder(principal, existing), replayed: true };
    }

    const result = repos.unitOfWork(() => {
      customer.assertMembership(customerId, restaurantId); // BR-04, BR-16
      const restaurant = repos.restaurants.findById(restaurantId);
      if (!restaurant || restaurant.status !== 'ACTIVE') throw new AppError('ORDER-003', 'Restaurant is not taking orders');
      // FR-32 / BR-17: only Lac 3 and Zone Industrielle Le Kram (ADR-0007).
      const workplace = repos.customers.findCustomer(customerId);
      assertInServiceArea({ restaurantZone: restaurant.serviceZone, workplaceZone: workplace.organizationZone });

      const now = clock.now();
      const gate = evaluateDeadline(now, restaurant.orderingDeadline); // BR-01
      if (!gate.open) {
        throw new AppError('ORDER-001', `Ordering for today closed at ${restaurant.orderingDeadline}`);
      }
      payments.assertMethodAvailable(restaurant, paymentMethod); // FR-25, FR-26

      const lines = buildLines(restaurantId, items);
      const totalMillimes = lines.reduce((sum, l) => sum + l.quantity * l.item.priceMillimes, 0); // FR-11, I-4
      const order = {
        orderId: newOrderId(), // FR-14
        customerId,
        restaurantId,
        status: ORDER_STATUS.SUBMITTED,
        totalMillimes,
        paymentMethod,
        paymentStatus: 'PENDING',
        createdAt: now.toISOString(),
        serviceDate: gate.serviceDate,
        deadlineSnapshot: gate.deadline.toISOString(), // D-04
        clientRequestId: idempotencyKey || null,
      };
      repos.orders.insertOrder(order);
      for (const { item, quantity } of lines) {
        repos.orders.insertOrderItem({
          orderItemId: newId('oi'),
          orderId: order.orderId,
          menuItemId: item.menuItemId,
          nameSnapshot: item.name,
          quantity,
          unitPriceMillimes: item.priceMillimes, // D-02 snapshot
        });
      }
      // I-3: the payment row is created in the same transaction. For e-payment
      // the capture happens here: if it fails, the whole order rolls back.
      const paymentStatus = payments.recordAtCheckout(order);
      if (paymentStatus !== order.paymentStatus) {
        repos.orders.updatePaymentAndProject(repos.orders.findCurrentPayment(order.orderId), paymentStatus, null, nowIso());
      }
      audit(principal, { restaurantId, action: 'ORDER_SUBMITTED', entity: 'orders', entityId: order.orderId });
      return order;
    });

    // D-08: events are raised after commit, never inside the transaction.
    const view = getOwnOrder(principal, result.orderId);
    const base = { orderId: view.orderId, restaurantId, customerId, status: view.status, total: view.total };
    notifications.publish(EVENTS.ORDER_SUBMITTED, base);
    notifications.publish(EVENTS.ORDER_CONFIRMED, base);
    return { order: view, replayed: false };
  }

  // ---- reads: three disjoint scopes (SDD §5.2.1) ---------------------------

  function getOwnOrder(principal, orderId) {
    const order = repos.orders.findForCustomer(principal.subjectId, orderId);
    if (!order) throw new AppError('NOT-FOUND', 'Order not found');
    return orderView(order);
  }

  /**
   * Builds views for many orders with two batch queries instead of two
   * queries per order (N+1 removed; see the refactor report).
   */
  function orderViews(orders) {
    const ids = orders.map((o) => o.orderId);
    const items = repos.orders.listItemsForOrders(ids);
    const assignments = repos.orders.listAssignmentsForOrders(ids);
    return orders.map((o) => orderView(o, { items: items.get(o.orderId) || [], assignment: assignments.get(o.orderId) || null }));
  }

  function listOwnOrders(principal) {
    return orderViews(repos.orders.listForCustomer(principal.subjectId));
  }

  function queueEntry(o, view) {
    return {
      ...view,
      customer: {
        customerId: o.customerId,
        fullName: o.customerName,
        phoneNumber: o.customerPhone,
        organizationName: o.organizationName,
        organizationZone: zoneLabel(o.organizationZone),
        eligible: o.customerEligible === 1,
      },
      allowedNext: allowedNext(o.status),
    };
  }

  /** FR-15 / FR-16: the restaurant's queue for a service day, with verification info. */
  function listRestaurantOrders(restaurantId, serviceDate) {
    const date = serviceDate || localDateString(clock.now());
    const orders = repos.orders.listForRestaurant(restaurantId, date);
    const views = orderViews(orders);
    return orders.map((o, i) => queueEntry(o, views[i]));
  }

  /** One queue entry, without loading the whole day's board. */
  function getRestaurantOrder(restaurantId, orderId) {
    const o = repos.orders.findQueueEntry(restaurantId, orderId);
    if (!o) throw new AppError('NOT-FOUND', 'Order not found');
    return queueEntry(o, orderView(o));
  }

  function restaurantOrderOrThrow(restaurantId, orderId) {
    const order = repos.orders.findForRestaurant(restaurantId, orderId);
    if (!order) throw new AppError('NOT-FOUND', 'Order not found');
    return order;
  }

  // ---- transitions ---------------------------------------------------------

  /**
   * D-09: every status change funnels through here and the State pattern.
   * Must be called inside a unit of work by the caller when combined with other writes.
   */
  function applyTransition(order, target, guardCtx) {
    const next = transition(order.status, target, guardCtx);
    repos.orders.updateStatus(order.restaurantId, order.orderId, next, nowIso());
    return next;
  }

  function publishStatus(order, status) {
    notifications.publish(EVENTS.ORDER_STATUS_CHANGED, {
      orderId: order.orderId, restaurantId: order.restaurantId, customerId: order.customerId, status,
    });
  }

  /** Restaurant accepts the order into preparation (Restaurant.acceptOrder). */
  function startPreparation(principal, restaurantId, orderId) {
    const order = restaurantOrderOrThrow(restaurantId, orderId);
    repos.unitOfWork(() => {
      applyTransition(order, ORDER_STATUS.IN_PREPARATION, {});
      audit(principal, { restaurantId, action: 'ORDER_IN_PREPARATION', entity: 'orders', entityId: orderId });
    });
    publishStatus(order, ORDER_STATUS.IN_PREPARATION);
    return getRestaurantOrder(restaurantId, orderId);
  }

  return {
    submitOrder,
    getOwnOrder,
    listOwnOrders,
    listRestaurantOrders,
    getRestaurantOrder,
    restaurantOrderOrThrow,
    startPreparation,
    applyTransition,
    publishStatus,
    orderView,
  };
}

module.exports = { createOrderManagement };
