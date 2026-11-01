'use strict';

const { localDateString, evaluateDeadline } = require('../domain/deadline');
const { forecastItem, backtest, indexHistory, addDays } = require('../domain/forecast');

const HISTORY_DAYS = 35;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * AI-assisted demand forecast and prep plan (BG-03, BG-04).
 *
 * Added after the team withdrew assumption A-13 (AI out of scope) on
 * 1 Nov 2026; recorded as FR-31 (PROPOSED) in the backlog.
 *
 * Human in the loop: the result is advice shown to restaurant staff. It never
 * accepts, refuses or changes an order, a payment, a customer's eligibility or
 * a menu item (spec §10 forbidden behaviour). If the model or the LLM fails,
 * the restaurant works exactly as before.
 */
function createForecastComponent({ repos, clock, llm, logger = console }) {
  /** The day the kitchen is preparing for next. */
  function targetDate(restaurant) {
    const now = clock.now();
    const gate = evaluateDeadline(now, restaurant.orderingDeadline);
    return gate.open ? gate.serviceDate : addDays(localDateString(now), 1);
  }

  /**
   * Skips weekdays on which the restaurant had no orders in the last four
   * weeks (it is usually closed), so the kitchen plans for its next real day.
   */
  function nextOpenDay(history, start) {
    const openWeekdays = new Set(history.days.slice(-28).map((d) => new Date(`${d}T12:00:00`).getDay()));
    if (openWeekdays.size === 0) return start;
    for (let i = 0; i < 7; i += 1) {
      const candidate = addDays(start, i);
      if (openWeekdays.has(new Date(`${candidate}T12:00:00`).getDay())) return candidate;
    }
    return start;
  }

  function buildForecast(restaurantId) {
    const restaurant = repos.restaurants.findById(restaurantId);
    const firstChoice = targetDate(restaurant);
    const recentRows = repos.orders.dailyItemQuantities(restaurantId, addDays(firstChoice, -HISTORY_DAYS), firstChoice);
    const date = nextOpenDay(indexHistory(recentRows), firstChoice);
    const rows = date === firstChoice ? recentRows : repos.orders.dailyItemQuantities(restaurantId, addDays(date, -HISTORY_DAYS), date);
    const history = indexHistory(rows);
    const items = repos.restaurants.listItems(restaurantId);
    const alreadyOrdered = new Map(
      repos.orders.dailyItemQuantities(restaurantId, date, addDays(date, 1)).map((r) => [r.menuItemId, r.quantity]),
    );

    const dishes = items
      .map((item) => {
        const f = forecastItem(history, item.menuItemId, date);
        return {
          menuItemId: item.menuItemId,
          name: item.name,
          available: item.available === 1,
          expected: f.expected,
          low: f.low,
          high: f.high,
          confidence: f.confidence,
          alreadyOrdered: alreadyOrdered.get(item.menuItemId) || 0,
          samples: f.samples,
        };
      })
      .sort((a, b) => b.expected - a.expected);

    const accuracy = history.days.length >= 10 ? backtest(history, items.map((i) => i.menuItemId), 7) : null;
    return {
      restaurantName: restaurant.name,
      serviceDate: date,
      weekday: WEEKDAYS[new Date(`${date}T12:00:00`).getDay()],
      historyDays: history.days.length,
      totals: {
        expected: dishes.reduce((s, d) => s + d.expected, 0),
        low: dishes.reduce((s, d) => s + d.low, 0),
        high: dishes.reduce((s, d) => s + d.high, 0),
        alreadyOrdered: dishes.reduce((s, d) => s + d.alreadyOrdered, 0),
      },
      dishes,
      accuracy,
      note: date === firstChoice ? null
        : `No orders on ${WEEKDAYS[new Date(`${firstChoice}T12:00:00`).getDay()]}s in the last four weeks, so this forecast is for the next day you usually open.`,
      method: 'Weighted average of the same weekday over the last 4 weeks (40/30/20/10 %), blended 60/40 with the last 7 service days.',
    };
  }

  function templateSummary(f) {
    if (f.historyDays === 0) {
      return 'There is no order history yet, so there is nothing to forecast. The forecast appears after a few days of orders.';
    }
    const top = f.dishes.filter((d) => d.expected > 0).slice(0, 3).map((d) => `${d.name} (about ${d.expected})`);
    const lines = [`Expect around ${f.totals.expected} dishes on ${f.weekday} (between ${f.totals.low} and ${f.totals.high}).`];
    if (top.length) lines.push(`Prepare most of: ${top.join(', ')}.`);
    const off = f.dishes.filter((d) => !d.available && d.expected > 0);
    if (off.length) lines.push(`${off.map((d) => d.name).join(', ')} usually sells but is marked unavailable.`);
    if (f.dishes.some((d) => d.confidence === 'low')) lines.push('Some dishes have little history, so treat their numbers as rough.');
    return lines.join(' ');
  }

  function prompt(f) {
    const table = f.dishes.map((d) => `- ${d.name}: expected ${d.expected} (range ${d.low}-${d.high}, confidence ${d.confidence}${d.available ? '' : ', currently marked unavailable'})`).join('\n');
    return [
      `You help the kitchen of a Tunisian restaurant plan lunch preparation for ${f.weekday} ${f.serviceDate}.`,
      `Statistical forecast of dishes to prepare (total ${f.totals.expected}, range ${f.totals.low}-${f.totals.high}):`,
      table,
      'Write at most 3 short sentences of practical prep advice for the kitchen staff.',
      'Use only the numbers above. Do not invent numbers, dishes or reasons. Do not mention customers.',
    ].join('\n');
  }

  async function getForecast(principal, restaurantId) {
    const forecast = buildForecast(restaurantId);
    let summary = templateSummary(forecast);
    let summarySource = 'template';
    if (llm && llm.enabled && forecast.historyDays > 0) {
      try {
        summary = await llm.complete(prompt(forecast));
        summarySource = `claude (${llm.model})`;
      } catch (err) {
        logger.error('[forecast] LLM summary failed, using template', err.message);
      }
    }
    repos.platform.audit({
      at: clock.now().toISOString(), actorRole: principal.role, actorId: principal.subjectId, restaurantId,
      action: 'FORECAST_VIEWED', entity: 'forecast', entityId: forecast.serviceDate, detail: JSON.stringify({ summarySource }),
    });
    return { ...forecast, summary, summarySource, advisory: 'AI-assisted advice. The restaurant decides what to prepare.' };
  }

  return { getForecast, buildForecast, templateSummary, prompt };
}

module.exports = { createForecastComponent };
