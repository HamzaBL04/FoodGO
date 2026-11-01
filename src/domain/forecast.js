'use strict';

/**
 * Demand forecasting model (pure functions, no I/O).
 *
 * For each dish: a weighted average of the same weekday over the last four
 * weeks (recent weeks weigh more), blended with the average of the last seven
 * service days. The band is ± the spread of the same-weekday values.
 * Deliberately simple and explainable: staff can check it by hand.
 */

const WEEKDAY_WEIGHTS = [0.4, 0.3, 0.2, 0.1];
const BLEND_WEEKDAY = 0.6;

function weekdayOf(dateString) {
  return new Date(`${dateString}T12:00:00`).getDay();
}

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * Builds a lookup from rows of { serviceDate, menuItemId, quantity }.
 * Returns { days: sorted service dates with any sale, qty(date, itemId) }.
 */
function indexHistory(rows) {
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.serviceDate)) byDay.set(r.serviceDate, new Map());
    byDay.get(r.serviceDate).set(r.menuItemId, r.quantity);
  }
  const days = [...byDay.keys()].sort();
  return { days, qty: (date, itemId) => (byDay.has(date) ? byDay.get(date).get(itemId) || 0 : null) };
}

/** Forecast one item for `targetDate` using only days strictly before it. */
function forecastItem(history, itemId, targetDate) {
  const weekday = weekdayOf(targetDate);
  const sameWeekday = [];
  for (let w = 1; w <= 4; w += 1) {
    const q = history.qty(addDays(targetDate, -7 * w), itemId);
    if (q !== null) sameWeekday.push(q); // null = restaurant closed that day
  }
  const recentDays = history.days.filter((d) => d < targetDate).slice(-7);
  const recent = recentDays.map((d) => history.qty(d, itemId));

  let estimate;
  if (sameWeekday.length) {
    const weights = WEEKDAY_WEIGHTS.slice(0, sameWeekday.length);
    const total = weights.reduce((a, b) => a + b, 0);
    const weekdayEstimate = sameWeekday.reduce((s, q, i) => s + q * weights[i], 0) / total;
    estimate = recent.length ? BLEND_WEEKDAY * weekdayEstimate + (1 - BLEND_WEEKDAY) * mean(recent) : weekdayEstimate;
  } else {
    estimate = mean(recent);
  }
  const spread = Math.max(1, Math.round(stddev(sameWeekday.length >= 2 ? sameWeekday : recent)));
  const expected = Math.round(estimate);
  let confidence = 'low';
  if (sameWeekday.length >= 4) confidence = 'high';
  else if (sameWeekday.length >= 2) confidence = 'medium';
  return {
    expected,
    low: Math.max(0, expected - spread),
    high: expected + spread,
    confidence,
    samples: { sameWeekday: sameWeekday.length, recentDays: recent.length },
    weekday,
  };
}

/**
 * Backtest: forecast each of the last `days` service days from the history
 * before it and compare total meals with what was actually sold.
 */
function backtest(history, itemIds, days = 7) {
  const testDays = history.days.slice(-days);
  const errors = [];
  for (const day of testDays) {
    const predicted = itemIds.reduce((s, id) => s + forecastItem(history, id, day).expected, 0);
    const actual = itemIds.reduce((s, id) => s + (history.qty(day, id) || 0), 0);
    errors.push({ day, predicted, actual, absError: Math.abs(predicted - actual) });
  }
  const mae = mean(errors.map((e) => e.absError));
  const meanActual = mean(errors.map((e) => e.actual));
  return {
    days: errors,
    meanAbsoluteError: Number(mae.toFixed(1)),
    meanAbsolutePercentError: meanActual ? Number(((mae / meanActual) * 100).toFixed(1)) : null,
  };
}

module.exports = { forecastItem, backtest, indexHistory, weekdayOf, addDays, mean, stddev };
