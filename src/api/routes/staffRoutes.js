'use strict';

const express = require('express');
const { requireRole, requireRestaurantScope, validate } = require('../middleware');
const { schemas } = require('../schemas');

/**
 * /restaurants/:restaurantId/... — Restaurant Interface (SDD §5.1.3).
 * Staff only; the restaurant id in the path must be the caller's own.
 * Order and delivery routes are added by their components' route modules.
 */
function staffRoutes({ components }) {
  const router = express.Router({ mergeParams: true });
  const { restaurantManagement: rm } = components;
  router.use(requireRole('STAFF'), requireRestaurantScope);

  const rid = (req) => req.params.restaurantId;

  router.get('/settings', (req, res) => res.json({ settings: rm.getSettings(rid(req)) }));
  router.put('/settings', validate(schemas.settings), (req, res) => {
    res.json({ settings: rm.updateSettings(req.principal, rid(req), req.valid) });
  });

  router.get('/menu', (req, res) => res.json({ items: rm.getMenu(rid(req)) }));
  router.post('/menu/items', validate(schemas.menuItem), (req, res) => {
    res.status(201).json({ item: rm.addMenuItem(req.principal, rid(req), req.valid) });
  });
  router.patch('/menu/items/:menuItemId', validate(schemas.menuItemPatch), (req, res) => {
    res.json({ item: rm.updateMenuItem(req.principal, rid(req), req.params.menuItemId, req.valid) });
  });
  router.delete('/menu/items/:menuItemId', (req, res) => {
    rm.removeMenuItem(req.principal, rid(req), req.params.menuItemId);
    res.status(204).end();
  });

  router.get('/customers', (req, res) => res.json({ customers: rm.listCustomers(rid(req)) }));
  router.post('/customers', validate(schemas.registerCustomer), (req, res) => {
    res.status(201).json({ customer: rm.registerCustomer(req.principal, rid(req), req.valid) });
  });
  router.get('/customers/:customerId', (req, res) => {
    res.json({ customer: rm.getCustomer(rid(req), req.params.customerId) });
  });
  router.patch('/customers/:customerId', validate(schemas.customerPatch), (req, res) => {
    res.json({ customer: rm.updateCustomer(req.principal, rid(req), req.params.customerId, req.valid) });
  });

  router.get('/delivery-personnel', (req, res) => res.json({ deliveryPersonnel: rm.listDeliveryPersonnel(rid(req)) }));
  router.post('/delivery-personnel', validate(schemas.deliveryPerson), (req, res) => {
    res.status(201).json({ deliveryPerson: rm.provisionDeliveryPerson(req.principal, rid(req), req.valid) });
  });

  return router;
}

/** /organizations — workplaces and institutions (FR-04), staff and admin. */
function organizationRoutes({ components }) {
  const router = express.Router();
  const { restaurantManagement: rm } = components;
  router.use(requireRole('STAFF', 'ADMIN'));
  router.get('/', (_req, res) => res.json({ organizations: rm.listOrganizations() }));
  router.post('/', validate(schemas.organization), (req, res) => {
    res.status(201).json({ organization: rm.createOrganization(req.principal, req.valid) });
  });
  return router;
}

module.exports = { staffRoutes, organizationRoutes };
