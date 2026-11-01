'use strict';

const { AppError } = require('../domain/errors');

const COOKIE = 'fg_session';

function readToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies ? req.cookies[COOKIE] : undefined;
}

/** Attaches req.principal when a valid session exists. */
function authenticate(auth) {
  return (req, _res, next) => {
    req.token = readToken(req);
    req.principal = auth.authenticate(req.token);
    next();
  };
}

/**
 * Constraint 4 (SDD §2.4): authorisation runs before the business component.
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.principal) return next(new AppError('AUTH-001', 'Sign in required'));
    if (!roles.includes(req.principal.role)) return next(new AppError('AUTH-002'));
    return next();
  };
}

/**
 * SDD §5.2.1: the restaurant scope is a required input of every
 * restaurant-scoped call and must match the caller's binding. It is never
 * inferred from the session alone.
 */
function requireRestaurantScope(req, _res, next) {
  const { restaurantId } = req.params;
  if (!restaurantId || restaurantId !== req.principal.restaurantId) {
    return next(new AppError('AUTH-002', 'You can only act on your own restaurant'));
  }
  return next();
}

/** Validates req.body (or another source) with a zod schema. */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source] ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return next(new AppError('VAL-001', `${where}${issue.message}`));
    }
    req.valid = parsed.data;
    return next();
  };
}

function setSessionCookie(res, token, { secure }) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 12 * 3600 * 1000 });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

module.exports = { authenticate, requireRole, requireRestaurantScope, validate, setSessionCookie, clearSessionCookie, COOKIE };
