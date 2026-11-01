'use strict';

const express = require('express');
const { requireRole, validate } = require('../middleware');
const { schemas } = require('../schemas');

/** /admin — platform scope only (SDD §5.2.1). */
function adminRoutes({ components }) {
  const router = express.Router();
  const { admin } = components;
  router.use(requireRole('ADMIN'));

  router.get('/restaurants', (_req, res) => res.json({ restaurants: admin.listRestaurants() }));
  router.post('/restaurants', validate(schemas.createRestaurant), (req, res) => {
    res.status(201).json({ restaurant: admin.createRestaurant(req.principal, req.valid) });
  });
  router.get('/staff', (_req, res) => res.json({ staff: admin.listStaff() }));
  router.post('/staff', validate(schemas.provisionStaff), (req, res) => {
    res.status(201).json({ staff: admin.provisionStaff(req.principal, req.valid) });
  });
  router.get('/monitor', (_req, res) => res.json(admin.monitor()));

  return router;
}

module.exports = { adminRoutes };
