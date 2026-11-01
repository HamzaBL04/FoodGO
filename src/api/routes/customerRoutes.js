'use strict';

const express = require('express');
const { requireRole } = require('../middleware');

/**
 * /customer/... — Customer Interface (SDD §5.1.2). Customer only.
 * No restaurant scope is accepted beyond those the membership allows.
 */
function customerRoutes({ components }) {
  const router = express.Router();
  const { customer } = components;
  router.use(requireRole('CUSTOMER'));

  router.get('/me', (req, res) => res.json({ profile: customer.getProfile(req.principal.subjectId) }));
  router.get('/restaurants', (req, res) => res.json({ restaurants: customer.listMyRestaurants(req.principal.subjectId) }));
  router.get('/restaurants/:restaurantId/menu', (req, res) => {
    res.json(customer.getMenu(req.principal.subjectId, req.params.restaurantId));
  });

  return router;
}

module.exports = { customerRoutes };
