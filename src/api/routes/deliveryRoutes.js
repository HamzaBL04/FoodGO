'use strict';

const express = require('express');
const { requireRole, validate } = require('../middleware');
const { schemas } = require('../schemas');

/**
 * /delivery/... — Delivery Interface (SDD §5.1.4). Delivery person only;
 * every action is authorised against the caller's own assignment (BR-08).
 */
function deliveryRoutes({ components }) {
  const router = express.Router();
  const { delivery } = components;
  router.use(requireRole('DELIVERY'));

  router.get('/assignments', (req, res) => res.json({ assignments: delivery.listMyAssignments(req.principal) }));
  router.get('/assignments/:assignmentId', (req, res) => {
    res.json({ assignment: delivery.getAssignmentDetail(req.principal, req.params.assignmentId) });
  });
  router.post('/assignments/:assignmentId/start', (req, res) => {
    res.json({ assignment: delivery.startDelivery(req.principal, req.params.assignmentId) });
  });
  router.post('/assignments/:assignmentId/confirm', validate(schemas.confirmDelivery), (req, res) => {
    res.json({ assignment: delivery.confirmDelivery(req.principal, req.params.assignmentId, req.valid) });
  });

  return router;
}

module.exports = { deliveryRoutes };
