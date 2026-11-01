'use strict';

const { mapRow, mapRows, requireScope } = require('./helpers');

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

/**
 * The order aggregate: orders, order_item, payment, delivery_assignment.
 * Three disjoint read scopes (SDD §5.2.1): own orders (customer), own
 * restaurant's orders (staff), own assignments (delivery person).
 */
// The restaurant queue row: order + the customer information staff need to
// verify it (FR-16). Shared by the list and the single-order lookup.
const QUEUE_SELECT = `SELECT o.*, c.full_name AS customer_name, c.phone_number AS customer_phone,
    org.name AS organization_name, rc.eligible AS customer_eligible
  FROM orders o
  JOIN customer c ON c.customer_id = o.customer_id
  JOIN organization org ON org.organization_id = c.organization_id
  JOIN restaurant_customer rc ON rc.restaurant_id = o.restaurant_id AND rc.customer_id = o.customer_id`;

function createOrderRepository(db) {
  const st = {
    insertOrder: db.prepare(`INSERT INTO orders (order_id, customer_id, restaurant_id, status, total_millimes,
        payment_method, payment_status, created_at, service_date, deadline_snapshot, updated_at, client_request_id)
      VALUES (@orderId, @customerId, @restaurantId, @status, @totalMillimes, @paymentMethod, @paymentStatus,
        @createdAt, @serviceDate, @deadlineSnapshot, @createdAt, @clientRequestId)`),
    orderByRequest: db.prepare('SELECT order_id FROM orders WHERE customer_id = ? AND client_request_id = ?'),
    insertItem: db.prepare(`INSERT INTO order_item (order_item_id, order_id, menu_item_id, name_snapshot, quantity, unit_price_millimes)
      VALUES (@orderItemId, @orderId, @menuItemId, @nameSnapshot, @quantity, @unitPriceMillimes)`),
    itemsForOrder: db.prepare('SELECT * FROM order_item WHERE order_id = ? ORDER BY name_snapshot'),
    itemsForOrders: db.prepare(`SELECT * FROM order_item
      WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, name_snapshot`),
    assignmentsForOrders: db.prepare(`SELECT a.*, d.full_name AS delivery_person_name FROM delivery_assignment a
      JOIN delivery_person d ON d.delivery_person_id = a.delivery_person_id
      WHERE a.order_id IN (SELECT value FROM json_each(?))`),
    orderForCustomer: db.prepare(`SELECT o.*, r.name AS restaurant_name FROM orders o
      JOIN restaurant r ON r.restaurant_id = o.restaurant_id WHERE o.order_id = ? AND o.customer_id = ?`),
    ordersForCustomer: db.prepare(`SELECT o.*, r.name AS restaurant_name FROM orders o
      JOIN restaurant r ON r.restaurant_id = o.restaurant_id WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 50`),
    orderForRestaurant: db.prepare('SELECT * FROM orders WHERE order_id = ? AND restaurant_id = ?'),
    ordersForRestaurant: db.prepare(`${QUEUE_SELECT}
      WHERE o.restaurant_id = @restaurantId AND o.service_date = @serviceDate
      ORDER BY o.created_at`),
    queueEntry: db.prepare(`${QUEUE_SELECT} WHERE o.restaurant_id = @restaurantId AND o.order_id = @orderId`),
    updateStatus: db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ? AND restaurant_id = ?'),
    projectPaymentStatus: db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE order_id = ?'),

    insertPayment: db.prepare(`INSERT INTO payment (payment_id, order_id, method, status, provider_reference, amount_millimes, created_at, updated_at)
      VALUES (@paymentId, @orderId, @method, @status, @providerReference, @amountMillimes, @createdAt, @createdAt)`),
    currentPayment: db.prepare('SELECT * FROM payment WHERE order_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1'),
    updatePayment: db.prepare('UPDATE payment SET status = ?, provider_reference = COALESCE(?, provider_reference), updated_at = ? WHERE payment_id = ?'),

    insertAssignment: db.prepare(`INSERT INTO delivery_assignment (assignment_id, order_id, delivery_person_id, restaurant_id, status, assigned_at)
      VALUES (@assignmentId, @orderId, @deliveryPersonId, @restaurantId, 'ASSIGNED', @assignedAt)`),
    assignmentForOrder: db.prepare(`SELECT a.*, d.full_name AS delivery_person_name FROM delivery_assignment a
      JOIN delivery_person d ON d.delivery_person_id = a.delivery_person_id WHERE a.order_id = ?`),
    assignmentForPerson: db.prepare(`SELECT * FROM delivery_assignment
      WHERE assignment_id = ? AND delivery_person_id = ? AND restaurant_id = ?`),
    assignmentsForPerson: db.prepare(`SELECT a.*, o.status AS order_status, o.total_millimes, o.payment_method, o.payment_status,
        c.full_name AS customer_name, org.name AS organization_name
      FROM delivery_assignment a
      JOIN orders o ON o.order_id = a.order_id
      JOIN customer c ON c.customer_id = o.customer_id
      JOIN organization org ON org.organization_id = c.organization_id
      WHERE a.delivery_person_id = ? AND a.restaurant_id = ?
      ORDER BY (a.status = 'COMPLETED'), a.assigned_at DESC LIMIT 50`),
    dailyItemQuantities: db.prepare(`SELECT o.service_date, oi.menu_item_id, SUM(oi.quantity) AS quantity
      FROM orders o JOIN order_item oi ON oi.order_id = o.order_id
      WHERE o.restaurant_id = @restaurantId AND o.service_date >= @fromDate AND o.service_date < @toDate
      GROUP BY o.service_date, oi.menu_item_id`),
    updateAssignment: db.prepare(`UPDATE delivery_assignment SET status = @status,
        started_at = COALESCE(@startedAt, started_at), completed_at = COALESCE(@completedAt, completed_at)
      WHERE assignment_id = @assignmentId AND restaurant_id = @restaurantId`),
  };

  return {
    insertOrder: (o) => st.insertOrder.run({ clientRequestId: null, ...o }),
    findOrderIdByRequest: (customerId, clientRequestId) => st.orderByRequest.get(customerId, clientRequestId)?.order_id || null,
    insertOrderItem: (i) => st.insertItem.run(i),
    listItems: (orderId) => mapRows(st.itemsForOrder.all(orderId)),
    /** Batch load (replaces one query per order): Map orderId -> items. */
    listItemsForOrders: (orderIds) => groupBy(mapRows(st.itemsForOrders.all(JSON.stringify(orderIds))), 'orderId'),
    /** Batch load: Map orderId -> assignment. */
    listAssignmentsForOrders: (orderIds) =>
      new Map(mapRows(st.assignmentsForOrders.all(JSON.stringify(orderIds))).map((a) => [a.orderId, a])),

    findForCustomer: (customerId, orderId) => mapRow(st.orderForCustomer.get(orderId, customerId)),
    listForCustomer: (customerId) => mapRows(st.ordersForCustomer.all(customerId)),
    findForRestaurant: (restaurantId, orderId) => {
      requireScope(restaurantId);
      return mapRow(st.orderForRestaurant.get(orderId, restaurantId));
    },
    listForRestaurant: (restaurantId, serviceDate) => {
      requireScope(restaurantId);
      return mapRows(st.ordersForRestaurant.all({ restaurantId, serviceDate }));
    },
    findQueueEntry: (restaurantId, orderId) => {
      requireScope(restaurantId);
      return mapRow(st.queueEntry.get({ restaurantId, orderId }));
    },
    updateStatus: (restaurantId, orderId, status, at) => {
      requireScope(restaurantId);
      return st.updateStatus.run(status, at, orderId, restaurantId);
    },

    insertPayment: (p) => st.insertPayment.run({ providerReference: null, ...p }),
    findCurrentPayment: (orderId) => mapRow(st.currentPayment.get(orderId)),
    /** D-03: the payment row is written and projected onto the order together. */
    updatePaymentAndProject: (payment, status, providerReference, at) => {
      st.updatePayment.run(status, providerReference || null, at, payment.paymentId);
      st.projectPaymentStatus.run(status, at, payment.orderId);
    },

    insertAssignment: (a) => {
      requireScope(a.restaurantId);
      return st.insertAssignment.run(a);
    },
    findAssignmentForOrder: (orderId) => mapRow(st.assignmentForOrder.get(orderId)),
    findAssignmentForPerson: (restaurantId, deliveryPersonId, assignmentId) => {
      requireScope(restaurantId);
      return mapRow(st.assignmentForPerson.get(assignmentId, deliveryPersonId, restaurantId));
    },
    listAssignmentsForPerson: (restaurantId, deliveryPersonId) => {
      requireScope(restaurantId);
      return mapRows(st.assignmentsForPerson.all(deliveryPersonId, restaurantId));
    },
    /** Forecast input: quantity sold per item per service day, [fromDate, toDate). */
    dailyItemQuantities: (restaurantId, fromDate, toDate) => {
      requireScope(restaurantId);
      return mapRows(st.dailyItemQuantities.all({ restaurantId, fromDate, toDate }));
    },
    updateAssignment: (a) => {
      requireScope(a.restaurantId);
      return st.updateAssignment.run({ startedAt: null, completedAt: null, ...a });
    },
  };
}

module.exports = { createOrderRepository };
