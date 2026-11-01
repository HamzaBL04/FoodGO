'use strict';

const crypto = require('node:crypto');

// Crockford-style alphabet without look-alike characters, so an order
// number read aloud over the phone is unambiguous (FR-14).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function newId(prefix) {
  return `${prefix}_${randomCode(12)}`;
}

/** Customer-facing unique order identifier, e.g. FG-7K2P9Q (FR-14). */
function newOrderId() {
  return `FG-${randomCode(6)}`;
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { newId, newOrderId, newToken, sha256, randomCode };
