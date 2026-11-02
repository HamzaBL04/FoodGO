'use strict';

const { AppError } = require('../domain/errors');
const { newId } = require('../domain/ids');
const { paymentMethodsFor } = require('./presenters');

const PAYMENT_STATUS = Object.freeze({ PENDING: 'PENDING', PAID: 'PAID' });

/**
 * Payment Component: FR-25 to FR-28, BR-12, BR-13.
 * Strategy pattern (SDD §7.1.1). One strategy per method family; the order
 * path never branches on the method. A new provider is one adapter and one
 * registry entry.
 */
class CashOnDeliveryStrategy {
  constructor() {
    this.method = 'CASH_ON_DELIVERY';
  }

  /** Nothing is collected at checkout. */
  atCheckout() {
    return { status: PAYMENT_STATUS.PENDING, providerReference: null };
  }

  /**
   * At delivery the delivery person records whether cash was collected.
   * How cash is reconciled afterwards is UNRESOLVED (spec FR-26, Q-22).
   */
  atDelivery({ order, cashCollected }) {
    if (!cashCollected) return null;
    return { status: PAYMENT_STATUS.PAID, providerReference: `CASH-${order.orderId}` };
  }
}

class EPaymentStrategy {
  constructor(adapter) {
    this.method = 'E_PAYMENT';
    this.adapter = adapter;
  }

  /** Captured through the provider adapter at checkout (BR-13). */
  atCheckout({ order }) {
    const result = this.adapter.capture({ orderId: order.orderId, amountMillimes: order.totalMillimes });
    return { status: PAYMENT_STATUS.PAID, providerReference: result.providerReference };
  }

  atDelivery() {
    return null;
  }
}

function createPaymentComponent({ repos, clock, paymentAdapter }) {
  const strategies = new Map([
    ['CASH_ON_DELIVERY', new CashOnDeliveryStrategy()],
    ['E_PAYMENT', new EPaymentStrategy(paymentAdapter)],
  ]);

  /** Resolves the strategy at runtime; no provider is hard-coded in callers. */
  function resolveStrategy(method) {
    const strategy = strategies.get(method);
    if (!strategy) throw new AppError('VAL-001', `Unsupported payment method ${method}`);
    return strategy;
  }

  /** FR-25 / FR-26: a method must be one the restaurant has enabled. */
  function assertMethodAvailable(restaurant, method) {
    if (!paymentMethodsFor(restaurant).includes(method)) {
      throw new AppError('VAL-001', 'This payment method is not available at this restaurant');
    }
  }

  /**
   * Inside T1: creates the order's first payment row (I-3) and applies the
   * checkout step of the strategy. Payment owns the status and writes the
   * order's projection in the same call (D-03). Returns the resulting status.
   */
  function recordAtCheckout(order) {
    const strategy = resolveStrategy(order.paymentMethod);
    const result = strategy.atCheckout({ order });
    const at = clock.now().toISOString();
    repos.orders.insertPaymentAndProject({
      paymentId: newId('pay'),
      orderId: order.orderId,
      method: order.paymentMethod,
      status: result.status,
      providerReference: result.providerReference,
      amountMillimes: order.totalMillimes,
      createdAt: at,
    });
    return result.status;
  }

  /**
   * Inside T3: applies the delivery step of the strategy. Payment owns the
   * status; the order's copy is a projection written in the same call (D-03).
   * Returns the new status, or null when nothing changed.
   */
  function recordAtDelivery(order, { cashCollected }) {
    const strategy = resolveStrategy(order.paymentMethod);
    const result = strategy.atDelivery({ order, cashCollected });
    if (!result) return null;
    const payment = repos.orders.findCurrentPayment(order.orderId);
    repos.orders.updatePaymentAndProject(payment, result.status, result.providerReference, clock.now().toISOString());
    return result.status;
  }

  return { resolveStrategy, assertMethodAvailable, recordAtCheckout, recordAtDelivery, PAYMENT_STATUS };
}

module.exports = { createPaymentComponent, CashOnDeliveryStrategy, EPaymentStrategy, PAYMENT_STATUS };
