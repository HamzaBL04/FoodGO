'use strict';

require('../helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { forecastItem, backtest, indexHistory, addDays, stddev, mean } = require('../../src/domain/forecast');
const { createAnthropicAdapter } = require('../../src/adapters/llmAdapter');

// Mondays 2026-10-05 .. 2026-10-26 plus a few recent days
function history(rows) {
  return indexHistory(rows.map(([serviceDate, menuItemId, quantity]) => ({ serviceDate, menuItemId, quantity })));
}

test('forecast weighs the same weekday, recent weeks more', () => {
  const h = history([
    ['2026-10-05', 'cous', 4], ['2026-10-12', 'cous', 6], ['2026-10-19', 'cous', 8], ['2026-10-26', 'cous', 10],
  ]);
  const f = forecastItem(h, 'cous', '2026-11-02');
  // weekday: 10*.4 + 8*.3 + 6*.2 + 4*.1 = 8.0 ; recent mean of the 4 days = 7 ; 0.6*8 + 0.4*7 = 7.6
  assert.equal(f.expected, 8);
  assert.equal(f.confidence, 'high');
  assert.equal(f.samples.sameWeekday, 4);
  assert.ok(f.low < f.expected && f.high > f.expected);
});

test('closed days do not count as zero demand', () => {
  const h = history([['2026-10-26', 'cous', 10], ['2026-10-31', 'cous', 9]]);
  const f = forecastItem(h, 'cous', '2026-11-02');
  assert.equal(f.samples.sameWeekday, 1, 'only 26 Oct was open on a Monday');
  assert.equal(f.confidence, 'low');
});

test('an item never sold forecasts zero; no history forecasts zero', () => {
  const h = history([['2026-10-26', 'cous', 10]]);
  assert.equal(forecastItem(h, 'brik', '2026-11-02').expected, 0);
  assert.equal(forecastItem(history([]), 'brik', '2026-11-02').expected, 0);
});

test('the forecast only uses days before the target date (no leakage)', () => {
  const h = history([['2026-10-26', 'cous', 10], ['2026-11-02', 'cous', 99]]);
  assert.equal(forecastItem(h, 'cous', '2026-11-02').expected, 10);
});

test('backtest reports mean absolute error over recent days', () => {
  const rows = [];
  for (let i = 0; i < 21; i += 1) rows.push([addDays('2026-10-10', i), 'cous', 10]);
  const r = backtest(history(rows), ['cous'], 7);
  assert.equal(r.days.length, 7);
  assert.equal(r.meanAbsoluteError, 0, 'constant demand is predicted exactly');
  assert.equal(r.meanAbsolutePercentError, 0);
});

test('statistics helpers', () => {
  assert.equal(mean([]), 0);
  assert.equal(stddev([5]), 0);
  assert.equal(stddev([2, 4, 4, 4, 5, 5, 7, 9]), 2);
});

test('LLM adapter is disabled without a key and calls the Messages API with one', async () => {
  const off = createAnthropicAdapter({ apiKey: '', model: 'm' });
  assert.equal(off.enabled, false);
  await assert.rejects(off.complete('x'), /disabled/);

  let sent;
  const fakeFetch = async (url, init) => {
    sent = { url, init };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Cook more couscous.' }] }) };
  };
  const on = createAnthropicAdapter({ apiKey: 'k', model: 'claude-test', fetchImpl: fakeFetch });
  assert.equal(await on.complete('plan'), 'Cook more couscous.');
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.init.headers['x-api-key'], 'k');
  assert.equal(JSON.parse(sent.init.body).model, 'claude-test');

  const failing = createAnthropicAdapter({ apiKey: 'k', model: 'm', fetchImpl: async () => ({ ok: false, status: 529 }) });
  await assert.rejects(failing.complete('x'), /529/);
  const empty = createAnthropicAdapter({ apiKey: 'k', model: 'm', fetchImpl: async () => ({ ok: true, json: async () => ({ content: [] }) }) });
  await assert.rejects(empty.complete('x'), /no text/);
});
