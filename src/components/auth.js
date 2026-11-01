'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { AppError } = require('../domain/errors');
const { newId, newToken, sha256 } = require('../domain/ids');

const ROLES = Object.freeze({ CUSTOMER: 'CUSTOMER', STAFF: 'STAFF', DELIVERY: 'DELIVERY', ADMIN: 'ADMIN' });

/**
 * Authentication & Access Control component (SDD §2.3, §5.3).
 * Produces a role and a restaurant scope; never decides business rules.
 */
function createAuthComponent({ repos, clock, sms, config }) {
  const nowIso = () => clock.now().toISOString();

  function hashPassword(plain) {
    return bcrypt.hashSync(plain, config.bcryptRounds);
  }

  function createSession(role, subjectId, restaurantId) {
    const token = newToken();
    const created = clock.now();
    const expires = new Date(created.getTime() + config.sessionTtlHours * 3600 * 1000);
    repos.platform.insertSession({
      tokenHash: sha256(token),
      role,
      subjectId,
      restaurantId: restaurantId || null,
      createdAt: created.toISOString(),
      expiresAt: expires.toISOString(),
    });
    return token;
  }

  function findAccount(role, identity) {
    if (role === ROLES.STAFF) {
      const a = repos.accounts.findStaffByIdentity(identity);
      return a && { id: a.staffId, restaurantId: a.restaurantId, fullName: a.fullName, hash: a.credentialHash, status: a.status };
    }
    if (role === ROLES.DELIVERY) {
      const a = repos.accounts.findDeliveryPersonByIdentity(identity);
      return a && { id: a.deliveryPersonId, restaurantId: a.restaurantId, fullName: a.fullName, hash: a.credentialHash, status: a.status };
    }
    if (role === ROLES.ADMIN) {
      const a = repos.accounts.findAdminByIdentity(identity);
      return a && { id: a.adminId, restaurantId: null, fullName: a.fullName, hash: a.credentialHash, status: 'ACTIVE' };
    }
    return null;
  }

  /** Staff, delivery person and administrator sign-in (password). */
  function signInWithPassword({ role, identity, password }) {
    const account = findAccount(role, identity);
    // Compare against a dummy hash when the account is unknown so response
    // time does not reveal which identities exist.
    const ok = bcrypt.compareSync(password, account ? account.hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    if (!account || !ok || account.status !== 'ACTIVE') {
      repos.platform.audit({ at: nowIso(), actorRole: role, actorId: identity, action: 'AUTH_FAILED' });
      throw new AppError('AUTH-001', 'Invalid identity or password');
    }
    const token = createSession(role, account.id, account.restaurantId);
    repos.platform.audit({ at: nowIso(), actorRole: role, actorId: account.id, restaurantId: account.restaurantId, action: 'SIGNED_IN' });
    return { token, principal: { role, subjectId: account.id, restaurantId: account.restaurantId, fullName: account.fullName } };
  }

  /** Customer sign-in step 1: send a one-time password by SMS (BR-05, FR-03). */
  function requestOtp({ phoneNumber }) {
    const customer = repos.customers.findCustomerByPhone(phoneNumber);
    const memberships = customer ? repos.customers.activeRestaurantIdsForCustomer(customer.customerId) : [];
    if (!customer || customer.status !== 'ACTIVE' || memberships.length === 0) {
      throw new AppError('AUTH-001', 'This phone number is not registered with a FoodGO restaurant. Ask the restaurant to register you in person.');
    }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const challengeId = newId('otp');
    const created = clock.now();
    repos.platform.insertOtp({
      challengeId,
      phoneNumber,
      codeHash: sha256(`${challengeId}:${code}`),
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + config.otpTtlMinutes * 60000).toISOString(),
    });
    sms.send(phoneNumber, `FoodGO code: ${code}. Valid ${config.otpTtlMinutes} minutes. Never share it.`);
    const result = { challengeId, expiresInSeconds: config.otpTtlMinutes * 60 };
    // Demo mode only: no real SMS provider is integrated (Q-22, §5.2.2).
    if (config.demoMode) result.demoCode = code;
    return result;
  }

  /** Customer sign-in step 2: verify the one-time password. */
  function verifyOtp({ challengeId, code }) {
    const challenge = repos.platform.findOtp(challengeId);
    const fail = () => new AppError('AUTH-001', 'Invalid or expired code');
    if (!challenge || challenge.consumed || challenge.expiresAt <= nowIso()) throw fail();
    if (challenge.attempts >= config.otpMaxAttempts) throw fail();
    repos.platform.recordOtpAttempt(challengeId);
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(sha256(`${challengeId}:${code}`), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) throw fail();
    repos.platform.consumeOtp(challengeId);
    const customer = repos.customers.findCustomerByPhone(challenge.phoneNumber);
    const token = createSession(ROLES.CUSTOMER, customer.customerId, null);
    repos.platform.audit({ at: nowIso(), actorRole: ROLES.CUSTOMER, actorId: customer.customerId, action: 'SIGNED_IN' });
    return { token, principal: { role: ROLES.CUSTOMER, subjectId: customer.customerId, restaurantId: null, fullName: customer.fullName } };
  }

  /** Resolves a bearer token to a principal, or null. */
  function authenticate(token) {
    if (!token) return null;
    const session = repos.platform.findSession(sha256(token), nowIso());
    if (!session) return null;
    return { role: session.role, subjectId: session.subjectId, restaurantId: session.restaurantId };
  }

  function signOut(token) {
    if (token) repos.platform.deleteSession(sha256(token));
  }

  /** Display name for the current principal (GET /auth/session). */
  function describe(principal) {
    const lookups = {
      CUSTOMER: () => repos.customers.findCustomer(principal.subjectId)?.fullName,
      STAFF: () => repos.accounts.findStaffById(principal.subjectId)?.fullName,
      DELIVERY: () => repos.accounts.findDeliveryPerson(principal.restaurantId, principal.subjectId)?.fullName,
      ADMIN: () => 'Platform Administrator',
    };
    const restaurant = principal.restaurantId ? repos.restaurants.findById(principal.restaurantId) : null;
    return { ...principal, fullName: lookups[principal.role](), restaurantName: restaurant ? restaurant.name : null };
  }

  /** FR-29: the platform provisions restaurant staff accounts. */
  function provisionStaff(admin, { restaurantId, identity, fullName, password }) {
    if (!repos.restaurants.findById(restaurantId)) throw new AppError('NOT-FOUND', 'Restaurant not found');
    if (repos.accounts.isIdentityTaken(identity)) throw new AppError('VAL-001', 'This identity is already in use');
    const staffId = newId('stf');
    repos.accounts.insertStaff({ staffId, restaurantId, identity, fullName, credentialHash: hashPassword(password) });
    repos.platform.audit({
      at: nowIso(), actorRole: ROLES.ADMIN, actorId: admin.subjectId, restaurantId,
      action: 'STAFF_PROVISIONED', entity: 'restaurant_staff', entityId: staffId,
    });
    return { staffId, restaurantId, identity, fullName, status: 'ACTIVE' };
  }

  return { ROLES, hashPassword, signInWithPassword, requestOtp, verifyOtp, authenticate, signOut, describe, provisionStaff };
}

module.exports = { createAuthComponent, ROLES };
