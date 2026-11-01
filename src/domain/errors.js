'use strict';

/**
 * Error model from the Software Specification §14.2.
 * The codes are the specification's (marked Proposed there); the HTTP
 * statuses are this implementation's mapping.
 */
const ERROR_CODES = Object.freeze({
  'AUTH-001': { status: 401, message: 'Authentication failed' },
  'AUTH-002': { status: 403, message: 'Authorization denied' },
  'VAL-001': { status: 400, message: 'Invalid input' },
  'ORDER-001': { status: 409, message: 'Ordering deadline passed' },
  'ORDER-002': { status: 409, message: 'Item unavailable' },
  'ORDER-003': { status: 422, message: 'Order creation failed' },
  'PAY-001': { status: 402, message: 'Payment failed' },
  'PAY-002': { status: 503, message: 'Payment provider unavailable' },
  'DEL-001': { status: 409, message: 'Delivery operation failed' },
  'NOT-FOUND': { status: 404, message: 'Resource not found' },
  'SYS-001': { status: 500, message: 'Internal system error' },
});

class AppError extends Error {
  /**
   * @param {keyof ERROR_CODES} code  specification error code
   * @param {string} [detail]          safe, user-facing detail
   */
  constructor(code, detail) {
    const known = ERROR_CODES[code] || ERROR_CODES['SYS-001'];
    super(detail || known.message);
    this.name = 'AppError';
    this.code = ERROR_CODES[code] ? code : 'SYS-001';
    this.status = known.status;
    this.detail = detail || known.message;
  }

  toJSON() {
    return { error: { code: this.code, message: this.detail } };
  }
}

module.exports = { AppError, ERROR_CODES };
