'use strict';

// Tunisian dinar has three decimals (1 TND = 1000 millimes). Amounts are
// stored and computed as integer millimes so totals are exact (FR-11, I-4).

function toMillimes(tnd) {
  return Math.round(Number(tnd) * 1000);
}

function fromMillimes(millimes) {
  return Number((millimes / 1000).toFixed(3));
}

function formatTnd(millimes) {
  return `${(millimes / 1000).toFixed(3)} TND`;
}

module.exports = { toMillimes, fromMillimes, formatTnd };
