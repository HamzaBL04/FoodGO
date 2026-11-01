'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ZONE_CODES, isServiceZone, zoneLabel, assertInServiceArea } = require('../../src/domain/serviceArea');
const { AppError } = require('../../src/domain/errors');

test('FR-32: the service area is exactly Lac 3 and Zone Industrielle Le Kram', () => {
  assert.deepEqual(ZONE_CODES, ['LAC_3', 'ZI_KRAM']);
  assert.equal(zoneLabel('LAC_3'), 'Lac 3');
  assert.equal(zoneLabel('ZI_KRAM'), 'Zone Industrielle Le Kram');
  for (const other of ['ENNASR', 'lac_3', '', null, undefined, 'toString']) {
    assert.equal(isServiceZone(other), false, String(other));
    assert.equal(zoneLabel(other), null);
  }
});

test('BR-17: both the restaurant and the workplace must be inside the service area', () => {
  assert.doesNotThrow(() => assertInServiceArea({ restaurantZone: 'LAC_3', workplaceZone: 'ZI_KRAM' }));
  for (const zones of [
    { restaurantZone: null, workplaceZone: 'LAC_3' },
    { restaurantZone: 'LAC_3', workplaceZone: null },
    { restaurantZone: 'SOUSSE', workplaceZone: 'LAC_3' },
  ]) {
    assert.throws(() => assertInServiceArea(zones), (e) => e instanceof AppError && e.code === 'ORDER-003');
  }
});
