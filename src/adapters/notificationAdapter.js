'use strict';

/**
 * Notification channel adapter (SDD §5.2.2): email / push are "in scope
 * where integrated". None is integrated yet, so messages go to an outbox and
 * the console. The in-app live status (SSE) is separate and always on.
 */
function createSandboxNotificationAdapter({ log = true } = {}) {
  const outbox = [];
  return {
    name: 'sandbox-notifications',
    notify(recipient, message) {
      outbox.unshift({ recipient, message, at: new Date().toISOString() });
      outbox.length = Math.min(outbox.length, 100);
      if (log) console.log(`[notify] ${recipient.role}:${recipient.id} — ${message}`);
    },
    outbox: () => outbox.slice(),
  };
}

module.exports = { createSandboxNotificationAdapter };
