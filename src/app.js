'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const { authenticate } = require('./api/middleware');
const { notFound, errorHandler } = require('./api/errorHandler');
const { authRoutes } = require('./api/routes/authRoutes');
const { adminRoutes } = require('./api/routes/adminRoutes');
const { staffRoutes, organizationRoutes } = require('./api/routes/staffRoutes');
const { customerRoutes } = require('./api/routes/customerRoutes');
const { customerOrderRoutes, restaurantOrderRoutes, eventRoutes } = require('./api/routes/orderRoutes');
const { deliveryRoutes } = require('./api/routes/deliveryRoutes');

/**
 * Builds the Express application (Presentation layer, SDD §2.2).
 * Route handlers stay thin: validate -> call one component -> respond.
 */
function createApp(ctx, { logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: ctx.clock.now().toISOString() }));

  const api = express.Router();
  api.use(authenticate(ctx.components.auth));
  api.get('/meta', (_req, res) => res.json({ name: 'FoodGO', version: '0.1.0', demoMode: ctx.config.demoMode }));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: ctx.config.isTest ? 10000 : 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'AUTH-001', message: 'Too many attempts, try again later' } },
  });
  api.use('/auth', authLimiter, authRoutes(ctx));
  api.use('/admin', adminRoutes(ctx));
  api.use('/organizations', organizationRoutes(ctx));
  api.use('/restaurants/:restaurantId/orders', restaurantOrderRoutes(ctx));
  api.use('/restaurants/:restaurantId', staffRoutes(ctx));
  api.use('/customer/orders', customerOrderRoutes(ctx));
  api.use('/customer', customerRoutes(ctx));
  api.use('/delivery', deliveryRoutes(ctx));
  api.use('/events', eventRoutes(ctx));
  app.use('/api/v1', api);

  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}

module.exports = { createApp };
