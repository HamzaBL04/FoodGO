'use strict';

/**
 * SMS / OTP adapter (SDD §5.2.2, Adapter pattern §7.1.2).
 * No Tunisian SMS provider has been selected, so this sandbox adapter keeps
 * an in-memory outbox and logs to the console. A real provider replaces this
 * file only; no business component changes.
 */
function createSandboxSmsAdapter({ log = true } = {}) {
  const outbox = [];
  return {
    name: 'sandbox-sms',
    send(phoneNumber, message) {
      const entry = { to: phoneNumber, message, at: new Date().toISOString() };
      outbox.unshift(entry);
      outbox.length = Math.min(outbox.length, 50);
      if (log) console.log(`[sms-sandbox] -> ${phoneNumber}: ${message}`);
      return { delivered: true, providerReference: `SMS-${Date.now()}` };
    },
    outbox: () => outbox.slice(),
  };
}

module.exports = { createSandboxSmsAdapter };
