'use strict';

const { AppError } = require('../domain/errors');

function camel(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Maps a snake_case row to a camelCase object; 0/1 flags stay numbers. */
function mapRow(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  return out;
}

function mapRows(rows) {
  return rows.map(mapRow);
}

/**
 * Constraint 3 / D-10: a restaurant-scoped repository method cannot be called
 * without its scope. Forgetting it is a programming error, not a data leak.
 */
function requireScope(restaurantId) {
  if (!restaurantId || typeof restaurantId !== 'string') {
    throw new AppError('SYS-001', 'restaurant scope is required for this query');
  }
}

module.exports = { mapRow, mapRows, requireScope };
