'use strict';

const { AppError } = require('./errors');

/**
 * FR-32 / BR-17 (team decision, 1 Nov 2026, ADR-0007): FoodGO operates in one
 * area only, Lac 3 / Zone Industrielle Le Kram (one zone, two names). Traffic
 * there gets heavy at lunchtime because employees leave work at the same time
 * to get food; pre-ordering keeps them at their desks.
 *
 * Every restaurant and every workplace (organization) records its zone. There
 * is a single zone today; the list exists so that serving another area later
 * is a team decision (new ADR), then one line here and one in migration 003's
 * CHECK.
 */
const SERVICE_ZONES = Object.freeze({
  LAC3_ZI_KRAM: 'Lac 3 / Zone Industrielle Le Kram',
});

const ZONE_CODES = Object.freeze(Object.keys(SERVICE_ZONES));

const AREA_NAME = SERVICE_ZONES.LAC3_ZI_KRAM;

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
    throw new AppError('ORDER-003', `FoodGO only takes orders in ${AREA_NAME}`);
  }
}

module.exports = { SERVICE_ZONES, ZONE_CODES, AREA_NAME, isServiceZone, zoneLabel, assertInServiceArea };
