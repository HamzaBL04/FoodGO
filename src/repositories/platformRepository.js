'use strict';

const { mapRow, mapRows } = require('./helpers');

/** Sessions, OTP challenges, audit trail and read-only monitoring queries. */
function createPlatformRepository(db) {
  const st = {
    insertSession: db.prepare(`INSERT INTO session (token_hash, role, subject_id, restaurant_id, created_at, expires_at)
      VALUES (@tokenHash, @role, @subjectId, @restaurantId, @createdAt, @expiresAt)`),
    session: db.prepare('SELECT * FROM session WHERE token_hash = ? AND expires_at > ?'),
    deleteSession: db.prepare('DELETE FROM session WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM session WHERE expires_at <= ?'),

    insertOtp: db.prepare(`INSERT INTO otp_challenge (challenge_id, phone_number, code_hash, attempts, consumed, created_at, expires_at)
      VALUES (@challengeId, @phoneNumber, @codeHash, 0, 0, @createdAt, @expiresAt)`),
    otp: db.prepare('SELECT * FROM otp_challenge WHERE challenge_id = ?'),
    otpAttempt: db.prepare('UPDATE otp_challenge SET attempts = attempts + 1 WHERE challenge_id = ?'),
    otpConsume: db.prepare('UPDATE otp_challenge SET consumed = 1 WHERE challenge_id = ?'),

    audit: db.prepare(`INSERT INTO audit_event (at, actor_role, actor_id, restaurant_id, action, entity, entity_id, detail)
      VALUES (@at, @actorRole, @actorId, @restaurantId, @action, @entity, @entityId, @detail)`),
    recentAudit: db.prepare('SELECT * FROM audit_event ORDER BY audit_id DESC LIMIT ?'),

    ordersByStatus: db.prepare(`SELECT r.restaurant_id, r.name, o.status, COUNT(*) AS n
      FROM restaurant r LEFT JOIN orders o ON o.restaurant_id = r.restaurant_id AND o.service_date = ?
      GROUP BY r.restaurant_id, o.status ORDER BY r.name`),
    counts: db.prepare(`SELECT
        (SELECT COUNT(*) FROM restaurant) AS restaurants,
        (SELECT COUNT(*) FROM customer) AS customers,
        (SELECT COUNT(*) FROM restaurant_staff) AS staff,
        (SELECT COUNT(*) FROM delivery_person) AS delivery_personnel,
        (SELECT COUNT(*) FROM orders) AS orders_total`),
  };

  return {
    insertSession: (s) => st.insertSession.run(s),
    findSession: (tokenHash, nowIso) => mapRow(st.session.get(tokenHash, nowIso)),
    deleteSession: (tokenHash) => st.deleteSession.run(tokenHash),
    purgeExpiredSessions: (nowIso) => st.purgeSessions.run(nowIso),

    insertOtp: (o) => st.insertOtp.run(o),
    findOtp: (id) => mapRow(st.otp.get(id)),
    recordOtpAttempt: (id) => st.otpAttempt.run(id),
    consumeOtp: (id) => st.otpConsume.run(id),

    audit: (e) => st.audit.run({ restaurantId: null, entity: null, entityId: null, detail: null, ...e }),
    recentAudit: (limit = 25) => mapRows(st.recentAudit.all(limit)),

    ordersByStatus: (serviceDate) => mapRows(st.ordersByStatus.all(serviceDate)),
    counts: () => mapRow(st.counts.get()),
  };
}

module.exports = { createPlatformRepository };
