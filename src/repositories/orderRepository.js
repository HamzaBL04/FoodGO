'use strict';

const { mapRow, mapRows, requireScope } = require('./helpers');

/**
 * The order aggregate: orders, order_item, payment, delivery_assignment.
 * Three disjoint read scopes (SDD §5.2.1): own orders (customer), own
 * restaurant's orders (staff), own assignments (delivery person).
 */
function createOrderRepository(db) {
  const st = {
    insertOrder: db.prepare(`INSERT INTO orders (order_id, customer_id, restaurant_id, status, total_millimes,
        payment_method, payment_status, created_at, service_date, deadline_snapshot, updated_at)
      VALUES (@orderId, @customerId, @restaurantId, @status, @totalMillimes, @paymentMethod, @paymentStatus,
        @createdAt, @serviceDate, @deadlineSnapshot, @createdAt)`),
    insertItem: db.prepare(`INSERT INTO order_item (order_item_id, order_id, menu_item_id, name_snapshot, quantity, unit_price_millimes)
      VALUES (@orderItemId, @orderId, @menuItemId, @nameSnapshot, @quantity, @unitPriceMillimes)`),
    itemsForOrder: db.prepare('SELECT * FROM order_item WHERE order_id = ? ORDER BY name_snapshot'),
    orderForCustomer: db.prepare(`SELECT o.*, r.name AS restaurant_name FROM orders o
      JOIN restaurant r ON r.restaurant_id = o.restaurant_id WHERE o.order_id = ? AND o.customer_id = ?`),
    ordersForCustomer: db.prepare(`SELECT o.*, r.name AS restaurant_name FROM orders o
      JOIN restaurant r ON r.restaurant_id = o.restaurant_id WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 50`),
    orderForRestaurant: db.prepare('SELECT * FROM orders WHERE order_id = ? AND restaurant_id = ?'),
    ordersForRestaurant: db.prepare(`SELECT o.*, c.full_name AS customer_name, c.phone_number AS customer_phone,
        org.name AS organization_name, rc.eligible AS customer_eligible
      FROM orders o
      JOIN customer c ON c.customer_id = o.customer_id
      JOIN organization org ON org.organization_id = c.organization_id
      JOIN restaurant_customer rc ON rc.restaurant_id = o.restaurant_id AND rc.customer_id = o.customer_id
      WHERE o.restaurant_id = @restaurantId AND o.service_date = @serviceDate
      ORDER BY o.created_at`),
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
    updateAssignment: db.prepare(`UPDATE delivery_assignment SET status = @status,
        started_at = COALESCE(@startedAt, started_at), completed_at = COALESCE(@completedAt, completed_at)
      WHERE assignment_id = @assignmentId AND restaurant_id = @restaurantId`),
  };

  return {
    insertOrder: (o) => st.insertOrder.run(o),
    insertOrderItem: (i) => st.insertItem.run(i),
    listItems: (orderId) => mapRows(st.itemsForOrder.all(orderId)),

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
    updateAssignment: (a) => {
      requireScope(a.restaurantId);
      return st.updateAssignment.run({ startedAt: null, completedAt: null, ...a });
    },
  };
}

module.exports = { createOrderRepository };
