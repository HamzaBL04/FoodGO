'use strict';

const crypto = require('node:crypto');
const { AppError } = require('../domain/errors');

/**
 * E-payment provider adapter (SDD §5.2.2, Adapter pattern §7.1.2).
 *
 * Which Tunisian providers are supported is UNRESOLVED (Q-22). This sandbox
 * adapter stands in for "a supported provider" so the Strategy can be built
 * and tested now. It only translates protocol: it holds no business rule.
 * Replacing it with a real provider changes this file and its registration.
 */
function createSandboxPaymentAdapter() {
  const state = { available: true, failNext: false };
  return {
    name: 'demopay-sandbox',
    /** Captures `amountMillimes` for an order. Returns a provider reference. */
    capture({ orderId, amountMillimes }) {
      if (!state.available) throw new AppError('PAY-002');
      if (state.failNext) {
        state.failNext = false;
        throw new AppError('PAY-001', 'The payment was declined by the provider (sandbox)');
      }
      if (!Number.isInteger(amountMillimes) || amountMillimes <= 0) throw new AppError('PAY-001', 'Invalid amount');
      return { status: 'CAPTURED', providerReference: `DEMOPAY-${orderId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` };
    },
    // test and demo hooks
    setAvailable(value) {
      state.available = value;
    },
    failNextCapture() {
      state.failNext = true;
    },
  };
}

module.exports = { createSandboxPaymentAdapter };
