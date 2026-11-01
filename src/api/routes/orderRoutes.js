'use strict';

const express = require('express');
const { requireRole, requireRestaurantScope, validate } = require('../middleware');
const { schemas } = require('../schemas');
const { AppError } = require('../../domain/errors');

/** /customer/orders — submit, list own, get own (UC-01, UC-12). */
function customerOrderRoutes({ components }) {
  const router = express.Router();
  const { orders } = components;
  router.use(requireRole('CUSTOMER'));

  router.post('/', validate(schemas.submitOrder), (req, res) => {
    const key = req.get('Idempotency-Key');
    if (key !== undefined && !/^[A-Za-z0-9-]{8,64}$/.test(key)) throw new AppError('VAL-001', 'Invalid Idempotency-Key');
    const { order, replayed } = orders.submitOrder(req.principal, req.valid, { idempotencyKey: key });
    res.status(replayed ? 200 : 201).json({ order, confirmation: `Order ${order.orderId} confirmed` });
  });
  router.get('/', (req, res) => res.json({ orders: orders.listOwnOrders(req.principal) }));
  router.get('/:orderId', (req, res) => res.json({ order: orders.getOwnOrder(req.principal, req.params.orderId) }));

  return router;
}

/** /restaurants/:restaurantId/orders — the restaurant's queue (FR-15, FR-16). */
function restaurantOrderRoutes({ components }) {
  const router = express.Router({ mergeParams: true });
  const { orders } = components;
  router.use(requireRole('STAFF'), requireRestaurantScope);

  router.get('/', (req, res) => {
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : undefined;
    res.json({ orders: orders.listRestaurantOrders(req.params.restaurantId, date) });
  });
  router.post('/:orderId/start-preparation', (req, res) => {
    res.json({ order: orders.startPreparation(req.principal, req.params.restaurantId, req.params.orderId) });
  });
  // FR-19: assign to one of this restaurant's own delivery personnel (Delivery Management).
  router.post('/:orderId/assign', validate(schemas.assign), (req, res) => {
    const { restaurantId, orderId } = req.params;
    res.json({ order: components.delivery.assignOrder(req.principal, restaurantId, orderId, req.valid.deliveryPersonId) });
  });

  return router;
}

/**
 * GET /events — Server-Sent Events. FR-24's live status view (E-04):
 * each viewer receives only the events BR-15 allows them to see.
 */
function eventRoutes({ components }) {
  const router = express.Router();
  const { notifications } = components;

  router.get('/', requireRole('CUSTOMER', 'STAFF', 'DELIVERY'), (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    const unsubscribe = notifications.subscribe((event) => {
      if (!notifications.visibleTo(req.principal, event)) return;
      const minimal = { type: event.type, orderId: event.orderId, status: event.status, at: event.at };
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(minimal)}\n\n`);
    });
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  return router;
}

module.exports = { customerOrderRoutes, restaurantOrderRoutes, eventRoutes };
