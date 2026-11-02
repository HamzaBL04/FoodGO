'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ZONE_CODES, AREA_NAME, isServiceZone, zoneLabel, assertInServiceArea } = require('../../src/domain/serviceArea');
const { AppError } = require('../../src/domain/errors');

test('FR-32: the service area is the single zone Lac 3 / Zone Industrielle Le Kram', () => {
  assert.deepEqual(ZONE_CODES, ['LAC3_ZI_KRAM']);
  assert.equal(AREA_NAME, 'Lac 3 / Zone Industrielle Le Kram');
  assert.equal(zoneLabel('LAC3_ZI_KRAM'), AREA_NAME);
  for (const other of ['LAC_3', 'ZI_KRAM', 'ENNASR', 'lac3_zi_kram', '', null, undefined, 'toString']) {
    assert.equal(isServiceZone(other), false, String(other));
    assert.equal(zoneLabel(other), null);
  }
});

test('BR-17: both the restaurant and the workplace must be inside the service area', () => {
  assert.doesNotThrow(() => assertInServiceArea({ restaurantZone: 'LAC3_ZI_KRAM', workplaceZone: 'LAC3_ZI_KRAM' }));
  for (const zones of [
    { restaurantZone: null, workplaceZone: 'LAC3_ZI_KRAM' },
    { restaurantZone: 'LAC3_ZI_KRAM', workplaceZone: null },
    { restaurantZone: 'SOUSSE', workplaceZone: 'LAC3_ZI_KRAM' },
  ]) {
    assert.throws(() => assertInServiceArea(zones), (e) => e instanceof AppError && e.code === 'ORDER-003');
  }
});
