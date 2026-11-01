'use strict';

const { AppError } = require('./errors');

/**
 * FR-32 / BR-17 (team decision, 1 Nov 2026, ADR-0007): FoodGO operates only in
 * Lac 3 and Zone Industrielle Le Kram. Everyone there orders lunch in the same
 * short window and drives out to get it; pre-ordering keeps them at their desk
 * and takes those trips off the roads at noon.
 *
 * Every restaurant and every workplace (organization) carries one of these
 * zones. Adding a zone is a team decision (new ADR), then one line here and
 * one in migration 003's CHECK.
 */
const SERVICE_ZONES = Object.freeze({
  LAC_3: 'Lac 3',
  ZI_KRAM: 'Zone Industrielle Le Kram',
});

const ZONE_CODES = Object.freeze(Object.keys(SERVICE_ZONES));

function isServiceZone(zone) {
  return typeof zone === 'string' && Object.prototype.hasOwnProperty.call(SERVICE_ZONES, zone);
}

function zoneLabel(zone) {
  return isServiceZone(zone) ? SERVICE_ZONES[zone] : null;
}

/**
 * BR-17: an order is taken only when the restaurant and the customer's
 * workplace are both inside the service area. Rows created before
 * migration 003 have no zone and are refused until one is set.
 */
function assertInServiceArea({ restaurantZone, workplaceZone }) {
  if (!isServiceZone(restaurantZone) || !isServiceZone(workplaceZone)) {
    throw new AppError('ORDER-003', 'FoodGO only takes orders in Lac 3 and Zone Industrielle Le Kram');
  }
}

module.exports = { SERVICE_ZONES, ZONE_CODES, isServiceZone, zoneLabel, assertInServiceArea };
