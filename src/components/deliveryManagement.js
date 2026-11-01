'use strict';

const { AppError } = require('../domain/errors');
const { newId } = require('../domain/ids');
const { fromMillimes } = require('../domain/money');
const { ORDER_STATUS, labelOf } = require('../domain/orderState');
const { EVENTS } = require('./notificationComponent');
const { createAuditor } = require('./audit');

const ASSIGNMENT_STATUS = Object.freeze({ ASSIGNED: 'ASSIGNED', STARTED: 'STARTED', COMPLETED: 'COMPLETED' });

/**
 * Delivery Management component (SDD §2.3). Assigns an order to a person the
 * restaurant already employs and records that journey. It does not employ,
 * dispatch-as-employer or equip anyone (constraint 8, BR-06, BR-07).
 * Order status changes are delegated to Order Management (constraint 5).
 */
function createDeliveryManagement({ repos, clock, orders, payments, notifications }) {
  const nowIso = () => clock.now().toISOString();

  const writeAudit = createAuditor({ repos, clock });
  const audit = (principal, restaurantId, action, entityId, detail) =>
    writeAudit(principal, { restaurantId, action, entity: 'delivery_assignment', entityId, detail: detail || null });

  function publish(type, order, assignment, extra = {}) {
    notifications.publish(type, {
      orderId: order.orderId,
      restaurantId: order.restaurantId,
      customerId: order.customerId,
      deliveryPersonId: assignment.deliveryPersonId,
      ...extra,
    });
  }

  /**
   * UC-02 step 1 / FR-19 — transaction T2: verify the person belongs to the
   * order's restaurant (I-8), persist the assignment, then move the order to
   * ASSIGNED. The assignment exists before anything can be dispatched (BR-10).
   */
  function assignOrder(principal, restaurantId, orderId, deliveryPersonId) {
    const order = orders.restaurantOrderOrThrow(restaurantId, orderId);
    const person = repos.accounts.findDeliveryPerson(restaurantId, deliveryPersonId);
    if (!person || person.status !== 'ACTIVE') {
      throw new AppError('DEL-001', 'This delivery person does not work for your restaurant');
    }
    if (repos.orders.findAssignmentForOrder(orderId)) {
      // Re-assignment is not described by the requirements (UNRESOLVED, Q-20).
      throw new AppError('DEL-001', 'This order is already assigned');
    }
    const assignmentId = newId('asg');
    repos.unitOfWork(() => {
      repos.orders.insertAssignment({ assignmentId, orderId, deliveryPersonId, restaurantId, assignedAt: nowIso() });
      const assignment = repos.orders.findAssignmentForOrder(orderId);
      orders.applyTransition(order, ORDER_STATUS.ASSIGNED, { assignment });
      audit(principal, restaurantId, 'DELIVERY_ASSIGNED', assignmentId, { orderId, deliveryPersonId });
    });
    const assignment = repos.orders.findAssignmentForOrder(orderId);
    publish(EVENTS.DELIVERY_ASSIGNED, order, assignment, { status: ORDER_STATUS.ASSIGNED });
    publish(EVENTS.ORDER_STATUS_CHANGED, order, assignment, { status: ORDER_STATUS.ASSIGNED });
    return orders.getRestaurantOrder(restaurantId, orderId);
  }

  /** FR-20 / BR-08: the query itself is scoped to this person. */
  function listMyAssignments(principal) {
    return repos.orders.listAssignmentsForPerson(principal.restaurantId, principal.subjectId).map((a) => ({
      assignmentId: a.assignmentId,
      orderId: a.orderId,
      status: a.status,
      orderStatus: a.orderStatus,
      orderStatusLabel: labelOf(a.orderStatus),
      customerName: a.customerName,
      destination: a.organizationName,
      total: fromMillimes(a.totalMillimes),
      paymentMethod: a.paymentMethod,
      paymentStatus: a.paymentStatus,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
    }));
  }

  function ownAssignmentOrThrow(principal, assignmentId) {
    const a = repos.orders.findAssignmentForPerson(principal.restaurantId, principal.subjectId, assignmentId);
    if (!a) throw new AppError('NOT-FOUND', 'Assignment not found');
    return a;
  }

  function orderForAssignment(assignment) {
    return repos.orders.findForRestaurant(assignment.restaurantId, assignment.orderId);
  }

  /**
   * FR-21 / BR-15: exactly the information needed to complete this delivery.
   * The delivery location representation is UNRESOLVED (Q-02); the customer's
   * registered workplace or campus is shown as the destination (PROPOSED).
   */
  function getAssignmentDetail(principal, assignmentId) {
    const a = ownAssignmentOrThrow(principal, assignmentId);
    const order = orderForAssignment(a);
    const c = repos.customers.findCustomer(order.customerId);
    const restaurant = repos.restaurants.findById(a.restaurantId);
    const view = orders.orderView(order, { assignment: null });
    return {
      assignmentId: a.assignmentId,
      status: a.status,
      assignedAt: a.assignedAt,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      order: { orderId: view.orderId, status: view.status, statusLabel: view.statusLabel, items: view.items, total: view.total },
      pickup: { restaurantName: restaurant.name, address: restaurant.address },
      customer: { fullName: c.fullName, phoneNumber: c.phoneNumber, destination: c.organizationName },
      payment: {
        method: order.paymentMethod,
        status: order.paymentStatus,
        amountToCollect: order.paymentMethod === 'CASH_ON_DELIVERY' && order.paymentStatus !== 'PAID' ? view.total : 0,
      },
    };
  }

  /** UC-02 / FR-22: the assignee starts the delivery; the order is dispatched. */
  function startDelivery(principal, assignmentId) {
    const a = ownAssignmentOrThrow(principal, assignmentId);
    if (a.status !== ASSIGNMENT_STATUS.ASSIGNED) throw new AppError('DEL-001', 'This delivery has already started');
    const order = orderForAssignment(a);
    repos.unitOfWork(() => {
      repos.orders.updateAssignment({ assignmentId, restaurantId: a.restaurantId, status: ASSIGNMENT_STATUS.STARTED, startedAt: nowIso() });
      const started = repos.orders.findAssignmentForOrder(a.orderId);
      orders.applyTransition(order, ORDER_STATUS.OUT_FOR_DELIVERY, { assignment: started });
      audit(principal, a.restaurantId, 'DELIVERY_STARTED', assignmentId);
    });
    publish(EVENTS.DELIVERY_STATUS_CHANGED, order, a, { status: ORDER_STATUS.OUT_FOR_DELIVERY });
    publish(EVENTS.ORDER_STATUS_CHANGED, order, a, { status: ORDER_STATUS.OUT_FOR_DELIVERY });
    return getAssignmentDetail(principal, assignmentId);
  }

  /**
   * UC-02 / UC-03 / FR-23 / FR-28 / BR-11 — transaction T3: verify the confirming
   * person owns the assignment, complete it, transition the order and apply
   * the payment strategy's delivery step, all or nothing.
   */
  function confirmDelivery(principal, assignmentId, { cashCollected } = {}) {
    const a = ownAssignmentOrThrow(principal, assignmentId);
    if (a.status !== ASSIGNMENT_STATUS.STARTED) throw new AppError('DEL-001', 'Start the delivery before confirming it');
    const order = orderForAssignment(a);
    let paymentStatus = null;
    repos.unitOfWork(() => {
      orders.applyTransition(order, ORDER_STATUS.DELIVERED, { assignment: a, actor: principal });
      repos.orders.updateAssignment({ assignmentId, restaurantId: a.restaurantId, status: ASSIGNMENT_STATUS.COMPLETED, completedAt: nowIso() });
      paymentStatus = payments.recordAtDelivery(order, { cashCollected: cashCollected === true });
      audit(principal, a.restaurantId, 'DELIVERY_CONFIRMED', assignmentId, { cashCollected: cashCollected === true });
    });
    publish(EVENTS.DELIVERY_STATUS_CHANGED, order, a, { status: ORDER_STATUS.DELIVERED });
    publish(EVENTS.ORDER_STATUS_CHANGED, order, a, { status: ORDER_STATUS.DELIVERED });
    if (paymentStatus) publish(EVENTS.PAYMENT_STATUS_CHANGED, order, a, { status: ORDER_STATUS.DELIVERED, paymentStatus });
    return getAssignmentDetail(principal, assignmentId);
  }

  return { assignOrder, listMyAssignments, getAssignmentDetail, startDelivery, confirmDelivery, ASSIGNMENT_STATUS };
}

module.exports = { createDeliveryManagement, ASSIGNMENT_STATUS };
