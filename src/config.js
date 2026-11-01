'use strict';

const path = require('node:path');

// The service is operated in Tunisia; the ordering deadline is a local
// wall-clock time, so the process time zone is fixed unless overridden.
process.env.TZ = process.env.TZ || 'Africa/Tunis';

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.FOODGO_DB || path.join(__dirname, '..', 'data', 'foodgo.db'),
  // Demo mode shows the one-time password on screen, because no real SMS
  // provider is integrated (provider selection is unresolved, Q-22 / §5.2.2).
  demoMode: process.env.FOODGO_DEMO_MODE !== 'false',
  bcryptRounds: env === 'test' ? 4 : 10,
  sessionTtlHours: 12,
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
};

module.exports = config;
