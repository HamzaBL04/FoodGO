'use strict';

const { createTestApp } = require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

test('every role page and its script are served', async () => {
  const { app } = createTestApp();
  for (const page of ['/', '/customer', '/restaurant', '/delivery', '/admin']) {
    const res = await request(app).get(page);
    assert.equal(res.status, 200, page);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /<script type="module" src="\/js\/\w+\.js"><\/script>/);
  }
  for (const asset of ['/js/api.js', '/js/customer.js', '/css/app.css', '/fonts/ibm-plex-sans-latin-400-normal.woff2']) {
    assert.equal((await request(app).get(asset)).status, 200, asset);
  }
});

test('security headers are set and the stack is not advertised', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/');
  assert.ok(res.headers['content-security-policy']);
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('meta endpoint exposes demo mode only', async () => {
  const { app } = createTestApp();
  const res = await request(app).get('/api/v1/meta');
  assert.deepEqual(Object.keys(res.body).sort(), ['demoMode', 'name', 'version']);
});
