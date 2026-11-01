'use strict';

/**
 * Shared audit-trail writer (spec §15 observability). Replaces three copies
 * of the same helper that lived in the order, restaurant and delivery
 * components (refactor report, smell S-3).
 */
function createAuditor({ repos, clock }) {
  return function audit(principal, { restaurantId = null, action, entity = null, entityId = null, detail = null }) {
    repos.platform.audit({
      at: clock.now().toISOString(),
      actorRole: principal.role,
      actorId: principal.subjectId,
      restaurantId,
      action,
      entity,
      entityId,
      detail: detail === null || typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  };
}

module.exports = { createAuditor };
